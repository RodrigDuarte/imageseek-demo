FROM python:3.11-slim

# working dir
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# creating the watched directory
RUN mkdir -p /app/watched

EXPOSE 5000

ENV FLASK_APP=main.py
ENV PYTHONUNBUFFERED=1

# run the app
CMD ["python", "main.py"]
