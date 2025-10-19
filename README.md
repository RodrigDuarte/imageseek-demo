# Image Seek

ImageSeek is a web-based multimodal image retrieval system that combines text-based and image-based retrieval methods through a hybrid score adjustment mechanism.

The codebase for ImageSeek is open-source and available in this repository. We also provide a public demonstration of the platform, available at: [http://imageseek.inesctec.pt](http://imageseek.inesctec.pt). Our demonstration application allows you to explore a dataset of 42,333 images from the Portuguese Presidency website through natural language queries in any language supported by the underlying models.

Unlike traditional rank fusion methods that normalize both modalities equally, our system uses an asymmetric score adjustment mechanism that treats image-based retrieval as a reliable baseline while harmonizing text-based scores through position-dependent adjustments.

## Installation

### Prerequisites

For local installation, ensure you have the following prerequisites:
- Python 3.8+
- Redis server
- Node.js and npm
- Access to watched folders containing images and documents

For Docker installation, ensure you have:
- Docker
- Docker Compose
- Access to watched folders containing images and documents

### Setup
0. Clone the repository:

   ```bash
   git clone https://github.com/RodrigDuarte/imageseek-demo.git
   ```
#### Local Setup

1. Navigate to the backend directory and install the required dependencies:

   ```bash
   cd backend 

   pip install -r requirements.txt
   ```

2. Configure the server:
   - Edit `config.json` to set Redis connection details
   - Update `watched_folders` with absolute paths to your image directories
   - Configure model settings in `models.json`

3. Start Redis server (if not already running):

   ```bash
   redis-server
   ```

4. Run the server:

   ```bash
   python main.py
   ```

The server will start on `http://0.0.0.0:5000`

1. Navigate to the `frontend` directory:

   ```bash
   cd frontend
   ```
2. Configure the frontend:
   - Update the environment file `.env` with the backend API URL (default is `http://localhost:5000`)

3. Install frontend dependencies and start the development server:

   ```bash  
   npm install
   npm run build
   ```

The frontend will be accessible at `http://localhost:5173`

#### Docker Setup

1. Configure `config.docker.json` and `models.json` as described above.

2. Run the compose setup:

   ```bash
   docker-compose up --build
   ```

The platform will be accessible at `http://localhost:8060` and the backend server at `http://localhost:8060/api`.

## Configuration

### config.json

Key configuration options:

- `redis_host`, `redis_port`, `redis_db`: Redis connection settings
- `watched_folders`: List of directories to monitor for new images
- `model_alias`: Default model to use for search
- `embedding_schedule`: Configuration for automatic embedding generation

### models.json

Contains available AI models for image search:

- **OpenCLIP**: Default model, multilingual support
- **MultilingualCLIP variants**: Support for multiple languages
- **BLIP-2**: Advanced vision-language understanding
- **CLIP variants**: Standard CLIP models

## Data Format

### Document Format

Documents must be in JSON format with the following structure to work with the hybrid search functionality:

```json
{
  "url": "https://www.example.com/article-url",
  "date": "2023-12-01",
  "title": "Article Title",
  "content": "The full text content of the document...",
  "images": [
    "image_1.jpg",
    "image_2.jpg",
    "image_3.jpg"
  ]
}
```

**Required fields:**

- `url`: The source URL of the document
- `date`: Publication date in YYYY-MM-DD format
- `title`: Document title
- `content`: Full text content of the document
- `images`: Array of image filenames associated with the document

**Notes:**

- Image filenames should match the actual image files in the watched folders
- The `images` array links documents to their associated images for hybrid search

## Usage

### Web Interface

Access the web interface at `http://localhost:8060` (for Docker installation) to:

- Perform image searches
- View search results
- Browse indexed images
- Access server status (development mode)

## Development

### Adding New Models

Add model configuration to `models.json`, implement model loading in `utils/controller.py`, and update search logic if needed.

### Monitoring

Server logs are written to `server.log`. Use `/api/status for` health checks and monitor Redis connection and model status.

### Logs

Check `server.log` for detailed error messages and debugging information.

## License

MIT License

Copyright (c) 2025 Rodrigo Duarte

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
