"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MIAMI DEAL PIPELINE
  Runs every morning. Searches Zillow for your
  neighborhoods, extracts listings, saves to deals.json.
  You don't run this manually — Railway does.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import requests
import json
import os
import re
import time
from datetime import datetime
from urllib.parse import quote

# ─── CONFIG ───────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
DEALS_PATH  = os.path.join(SCRIPT_DIR, "deals.json")

SCRAPER_API_KEY  = os.environ.get("SCRAPER_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def load_deals():
    if os.path.exists(DEALS_PATH):
        with open(DEALS_PATH, "r") as f:
            return json.load(f)
    return []

def save_deals(deals):
    with open(DEALS_PATH, "w") as f:
        json.dump(deals, f, indent=2)

# ─── BUILD ZILLOW SEARCH URL ─────────────────────────────────
# Zillow search URLs follow a pattern. We construct one per neighborhood
# with your price and property type filters baked in.
def build_zillow_url(neighborhood, max_price, property_types):
    # Map our property type names to Zillow's filter values
    type_map = {
        "single_family": "house",
        "multifamily": "multi_family",
        "land": "lot",
    }
    zillow_types = [type_map[t] for t in property_types if t in type_map]

    # Zillow search base
    base = f"https://www.zillow.com/search/getresults.json"

    # We'll use the HTML search page URL instead — more reliable for scraping
    encoded_location = quote(neighborhood)
    url = (
        f"https://www.zillow.com/homes/for_sale/"
        f"?searchQueryState="
        + quote(json.dumps({
            "isMapVisible": True,
            "isListVisible": True,
            "filterState": {
                "price": {"max": max_price},
                "propertyType": {"value": zillow_types},
            },
            "usersSearchTerm": neighborhood,
            "pagination": {},
        }))
    )
    return url

# ─── SCRAPE A ZILLOW SEARCH PAGE ─────────────────────────────
def scrape_search_page(url):
    """Use ScraperAPI to fetch a Zillow search results page."""
    try:
        resp = requests.get(
            "https://api.scraperapi.com/",
            params={
                "api_key": SCRAPER_API_KEY,
                "url": url,
                "render": "true",
                "country_code": "us",
            },
            timeout=45
        )
        credits_left = resp.headers.get("sa-credit-remaining", "?")
        print(f"    ScraperAPI: status={resp.status_code} | credits remaining: {credits_left}")

        if resp.status_code != 200:
            print(f"    ✗ ScraperAPI error: {resp.status_code}")
            return None
        return resp.text

    except Exception as e:
        print(f"    ✗ Fetch failed: {e}")
        return None

# ─── EXTRACT LISTINGS WITH CLAUDE ────────────────────────────
def extract_listings(html, neighborhood):
    """Send the scraped HTML to Claude. It finds all listings and returns structured JSON."""
    # Strip down HTML — remove script/style, collapse whitespace
    text = re.sub(r'<script[\s\S]*?</script>', '', html, flags=re.IGNORECASE)
    text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text[:20000]  # cap it

    prompt = f"""You are looking at a Zillow search results page for real estate listings in {neighborhood}, Miami.

Extract EVERY property listing you can find on this page. For each listing, return:
- address (full street address)
- price (number, no $ or commas)
- lotSize (number in sqft, or null)
- beds (number or null)
- baths (number or null)  
- sqft (living area, number or null)
- propertyType ("land", "single_family", "multifamily", or "unknown")
- url (the Zillow listing URL if visible, or null)
- status ("for sale", "pending", "sold", or "unknown")

Return ONLY a valid JSON array of objects. No markdown fences, no explanation, just the array.
Example: [{{"address": "123 Main St", "price": 500000, ...}}, ...]

If you find zero listings, return an empty array: []

Page text:
{text}"""

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 4000,
                "messages": [{ "role": "user", "content": prompt }]
            },
            timeout=30
        )

        if resp.status_code != 200:
            print(f"    ✗ Claude error: {resp.status_code} — {resp.text[:300]}")
            return []

        raw = resp.json()["content"][0]["text"].strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        # Extract the JSON array
        match = re.search(r'\[[\s\S]*\]', raw)
        if match:
            listings = json.loads(match.group())
            print(f"    ✓ Claude extracted {len(listings)} listings")
            return listings
        else:
            print(f"    ✗ No JSON array found in Claude response")
            return []

    except Exception as e:
        print(f"    ✗ Claude extraction failed: {e}")
        return []

# ─── DEDUPLICATE ─────────────────────────────────────────────
def deduplicate(new_listings, existing_deals):
    """
    Don't re-add a deal we already have.
    Match on address (normalized — lowercase, stripped).
    If price changed on an existing deal, log it to price history.
    """
    existing_by_address = {}
    for d in existing_deals:
        key = d.get("address", "").lower().strip()
        if key:
            existing_by_address[key] = d

    truly_new = []
    updated = []

    for listing in new_listings:
        key = (listing.get("address") or "").lower().strip()
        if not key:
            continue

        if key in existing_by_address:
            # Already have it — check if price changed
            existing = existing_by_address[key]
            old_price = existing.get("price_history", [{}])[-1].get("price") if existing.get("price_history") else existing.get("price")
            new_price = listing.get("price")

            if new_price and old_price and new_price != old_price:
                existing["price_history"].append({
                    "price": new_price,
                    "date": datetime.now().strftime("%Y-%m-%d")
                })
                existing["price"] = new_price
                existing["last_seen"] = datetime.now().strftime("%Y-%m-%d %H:%M")
                updated.append(existing["address"])
        else:
            # Brand new listing
            truly_new.append(listing)

    return truly_new, updated

# ─── MAIN ─────────────────────────────────────────────────────
def main():
    print(f"\n{'━'*50}")
    print(f"  MIAMI DEAL PIPELINE — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'━'*50}\n")

    # Validate keys
    if not SCRAPER_API_KEY:
        print("✗ SCRAPER_API_KEY not set. Add it as an environment variable in Railway.")
        return
    if not ANTHROPIC_API_KEY:
        print("✗ ANTHROPIC_API_KEY not set. Add it as an environment variable in Railway.")
        return

    # Show key shape so we can confirm Railway is reading them correctly
    print(f"  SCRAPER_API_KEY: {SCRAPER_API_KEY[:8]}...{SCRAPER_API_KEY[-4:]} (len={len(SCRAPER_API_KEY)})")
    print(f"  ANTHROPIC_API_KEY: {ANTHROPIC_API_KEY[:8]}...{ANTHROPIC_API_KEY[-4:]} (len={len(ANTHROPIC_API_KEY)})")

    # Quick test: validate Anthropic key with a tiny call
    print("  Testing Anthropic key...")
    try:
        test_resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 10,
                "messages": [{ "role": "user", "content": "Say OK" }]
            },
            timeout=15
        )
        if test_resp.status_code == 200:
            print("  ✓ Anthropic key is valid")
        else:
            print(f"  ✗ Anthropic key test failed: {test_resp.status_code} — {test_resp.text[:300]}")
            return
    except Exception as e:
        print(f"  ✗ Anthropic key test failed: {e}")
        return

    config = load_config()
    neighborhoods = config["search"]["neighborhoods"]
    max_price = config["search"]["max_price"]
    property_types = config["search"]["property_types"]

    print(f"  Searching {len(neighborhoods)} neighborhoods | max ${max_price:,} | types: {property_types}\n")

    all_new_listings = []

    for i, neighborhood in enumerate(neighborhoods):
        print(f"  [{i+1}/{len(neighborhoods)}] {neighborhood}")

        # Build URL
        url = build_zillow_url(neighborhood, max_price, property_types)
        print(f"    Scraping...")

        # Scrape
        html = scrape_search_page(url)
        if not html:
            print(f"    Skipping — no HTML returned.")
            continue

        # Extract
        listings = extract_listings(html, neighborhood)
        if listings:
            # Tag each listing with the neighborhood it came from
            for l in listings:
                l["neighborhood"] = neighborhood
            all_new_listings.extend(listings)

        # Be polite — small delay between requests
        time.sleep(2)

    print(f"\n  Total raw listings found: {len(all_new_listings)}")

    # Load existing deals and deduplicate
    existing_deals = load_deals()
    truly_new, price_updates = deduplicate(all_new_listings, existing_deals)

    print(f"  New listings: {len(truly_new)}")
    print(f"  Price updates: {len(price_updates)}")

    # Format new listings into deal objects
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    new_deals = []
    for l in truly_new:
        deal = {
            "address": l.get("address", ""),
            "neighborhood": l.get("neighborhood", ""),
            "price": l.get("price"),
            "lotSize": l.get("lotSize"),
            "beds": l.get("beds"),
            "baths": l.get("baths"),
            "sqft": l.get("sqft"),
            "propertyType": l.get("propertyType", "unknown"),
            "status": l.get("status", "unknown"),
            "zoning": "",  # zoning lookup is done in the dashboard
            "url": l.get("url"),
            "added_at": now,
            "last_seen": now,
            "is_new": True,  # flag so dashboard can highlight it
            "price_history": [{ "price": l.get("price"), "date": now }] if l.get("price") else [],
        }
        new_deals.append(deal)

    # Merge: new deals at the top, then existing
    # Clear the "is_new" flag on old deals
    for d in existing_deals:
        d["is_new"] = False

    all_deals = new_deals + existing_deals
    save_deals(all_deals)

    print(f"\n  ✓ Saved {len(all_deals)} total deals to deals.json")
    if truly_new:
        print(f"  ✓ {len(truly_new)} new deals added")
    if price_updates:
        print(f"  ✓ Price updates logged: {', '.join(price_updates[:5])}" + ("..." if len(price_updates) > 5 else ""))
    print(f"\n{'━'*50}\n")

# ---- HTTP SERVER ----
# Serves deals.json and keeps Railway container alive

from http.server import HTTPServer, BaseHTTPRequestHandler
import os

DEALS_PATH = "deals.json"  # make sure this file exists

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Root (Railway / browser)
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
            return

        # Health check
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
            return

        # Serve deals.json
        if self.path == "/deals.json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with open(DEALS_PATH, "rb") as f:
                self.wfile.write(f.read())
            return

        # Anything else
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass  # silence logs


def start_server():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Server running on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    start_server()
