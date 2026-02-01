# Dockerfile
# Railway reads this and knows how to run your scraper.
# You don't need to understand this — just deploy it as-is.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything in
COPY . .

# Run the scraper once when the container starts.
# Railway will restart it on schedule (you set that in Railway's UI).
CMD ["python", "scraper.py"]
