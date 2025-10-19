import os
import json

from flask import request
from flask import jsonify
from flask import render_template
from flask import send_from_directory
from flask import abort
from flask_cors import CORS

from utils.server import Server

s = Server()

CORS(s.app, origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://localhost", "http://localhost:80"])

@s.app.route("/")
def health():
    return "Backend is running!", 200

@s.app.route("/old_version")
def index():
    """Landing page for the image search engine"""
    return render_template("index.html")

@s.app.route("/search", methods=["POST"])
def search():
    """Handle image search requests using the default model"""
    try:
        query = request.json.get("query", "").strip()
        max_results = request.json.get("max_results", 6)

        if max_results not in [4, 8, 16, 32]:
            max_results = 8  # Default fallback

        if not query:
            return jsonify({"error": "Search query is required"}), 400

        model_status = s.controller.get_model_status(s.model_alias)

        if model_status == 1:
            return jsonify(
                {
                    "status": "model_loading",
                    "message": f"Model '{s.model_alias}' is currently loading",
                    "suggestion": "Please wait and check /api/search/status or retry in a few moments",
                }
            ), 202

        if not s.ensure_model_loaded():
            model_status = s.controller.get_model_status(s.model_alias)
            if model_status == 1:
                return jsonify(
                    {
                        "status": "model_loading",
                        "message": f"Model '{s.model_alias}' is now loading",
                        "suggestion": "Please wait and check /api/search/status or retry in a few moments",
                    }
                ), 202  # Accepted
            else:
                return jsonify(
                    {
                        "error": f"Failed to load model '{s.model_alias}'",
                        "suggestion": "Check server logs for details or try POST /api/model/load",
                    }
                ), 503

        results = s.controller.search(s.model_alias, query, top_k=max_results)

        if results and hasattr(results, "docs"):
            search_results = []
            for doc in results.docs:
                if hasattr(doc, "hidden") and getattr(doc, "hidden", "false") == "true":
                    continue

                doc_dict = {}
                for key, value in doc.__dict__.items():
                    if key != "payload":  # Skip payload as it might contain binary data
                        doc_dict[key] = value
                search_results.append(doc_dict)

            return jsonify(
                {
                    "query": query,
                    "model": s.model_alias,
                    "results": search_results,
                    "total": len(search_results),
                }
            )
        else:
            return jsonify(
                {
                    "query": query,
                    "model": s.model_alias,
                    "results": [],
                    "total": 0,
                    "message": "No results found or search failed",
                }
            )

    except Exception as e:
        s.server_log(f"[ERROR] Search failed: {e}")
        return jsonify({"error": str(e)}), 500


@s.app.route("/search_complex", methods=["POST"])
def search_complex():
    """Handle hybrid search requests with fallback to image search"""
    try:
        query = request.json.get("query", "").strip()
        max_results = request.json.get("max_results", 6)
        hybrid_function = request.json.get("hybrid_function", 1)

        if max_results not in [4, 8, 16, 32]:
            max_results = 8  # Default fallback

        if not query:
            return jsonify({"error": "Search query is required"}), 400

        model_status = s.controller.get_model_status(s.model_alias)

        if model_status == 1:  # ModelStatus.LOADING
            return jsonify(
                {
                    "status": "model_loading",
                    "message": f"Model '{s.model_alias}' is currently loading",
                    "suggestion": "Please wait and check /api/search/status or retry in a few moments",
                }
            ), 202

        if not s.ensure_model_loaded():
            model_status = s.controller.get_model_status(s.model_alias)
            if model_status == 1:
                return jsonify(
                    {
                        "status": "model_loading",
                        "message": f"Model '{s.model_alias}' is now loading",
                        "suggestion": "Please wait and check /api/search/status or retry in a few moments",
                    }
                ), 202
            else:
                return jsonify(
                    {
                        "error": f"Failed to load model '{s.model_alias}'",
                    }
                ), 503

        hybrid_error = None

        # Try hybrid search first
        try:
            results = s.controller.search_complex(
                s.model_alias, query, top_k=max_results, function_option=hybrid_function
            )

            if len(results) > 0:
                search_results = []
                for result in results:
                    hash_value = result.get("hash", "")
                    if hash_value:
                        image_data = s.rc.hgetall(f"image:{hash_value}")
                        if image_data:
                            search_result = s.rc.decode_object(image_data)

                            if search_result.get("hidden", "false") == "true":
                                continue

                            # Add score information from hybrid search
                            search_result["score"] = result.get("final_score", 0.0)
                            search_results.append(
                                {
                                    "id": f"image:{search_result['hash']}",
                                    "hash": search_result["hash"],
                                    "score": str(search_result["score"]),
                                }
                            )

                return jsonify(
                    {
                        "query": query,
                        "model": s.model_alias,
                        "search_type": "hybrid",
                        "results": search_results,
                        "total": len(search_results),
                    }
                )
            else:
                hybrid_error = "Hybrid search returned no results - documents may be missing for images"
        except Exception as e:
            hybrid_error = f"Hybrid search failed: {str(e)}"
            s.server_log(f"[WARNING] Hybrid search failed, attempting fallback: {e}")

        # Fallback to regular image search
        s.server_log(f"[INFO] Falling back to image search due to: {hybrid_error}")

        try:
            image_results = s.controller.search(s.model_alias, query, top_k=max_results)

            if image_results and hasattr(image_results, "docs"):
                search_results = []
                for doc in image_results.docs:
                    if (
                        hasattr(doc, "hidden")
                        and getattr(doc, "hidden", "false") == "true"
                    ):
                        continue

                    doc_dict = {}
                    for key, value in doc.__dict__.items():
                        if (
                            key != "payload"
                        ):  # Skip payload as it might contain binary data
                            doc_dict[key] = value
                    search_results.append(doc_dict)

                return jsonify(
                    {
                        "query": query,
                        "model": s.model_alias,
                        "search_type": "image_fallback",
                        "results": search_results,
                        "total": len(search_results),
                        "warning": {
                            "type": "hybrid_search_fallback",
                            "message": "Hybrid search unavailable - showing image results instead",
                            "reason": hybrid_error,
                            "suggestion": "To enable hybrid search, ensure all images have associated documents",
                        },
                    }
                )
            else:
                return jsonify(
                    {
                        "query": query,
                        "model": s.model_alias,
                        "search_type": "hybrid",
                        "results": [],
                        "total": 0,
                        "warning": {
                            "type": "no_results",
                            "message": "No results found in both hybrid and image search",
                            "reason": hybrid_error,
                        },
                    }
                )

        except Exception as fallback_error:
            s.server_log(
                f"[ERROR] Both hybrid and image search failed: {fallback_error}"
            )
            return jsonify(
                {
                    "error": "Both hybrid and image search failed",
                    "hybrid_error": hybrid_error,
                    "fallback_error": str(fallback_error),
                }
            ), 500

    except Exception as e:
        s.server_log(f"[ERROR] Search complex endpoint failed: {e}")
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/search/status", methods=["GET"])
def search_status():
    """Get current search/model status for dynamic loading"""
    try:
        model_status = s.controller.get_model_status(s.model_alias)
        dynamic_status = s.get_dynamic_loading_status()

        status_info = {
            "model_alias": s.model_alias,
            "model_status": {0: "unloaded", 1: "loading", 2: "loaded"}.get(
                model_status, "unknown"
            ),
            "model_status_code": model_status,
            "dynamic_loading": dynamic_status,
            "ready_for_search": model_status == 2,
        }

        return jsonify(status_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/status")
def status():
    """Server status and statistics endpoint"""
    if s.production:
        abort(404)

    try:
        stats = s.get_server_statistics()
        schedule_status = s.get_embedding_schedule_status()
        model_status = s.controller.get_model_status(s.model_alias)
        model_status_text = {0: "UNLOADED", 1: "LOADING", 2: "LOADED"}.get(
            model_status, "UNKNOWN"
        )
        dynamic_loading_status = s.get_dynamic_loading_status()

        return jsonify(
            {
                "status": "healthy",
                "app_name": s.app_name,
                "version": s.version,
                "redis_connected": s.rc is not None,
                "model": {"alias": s.model_alias, "status": model_status_text},
                "dynamic_loading": dynamic_loading_status,
                "statistics": stats,
                "embedding_schedule": schedule_status,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/model/load", methods=["POST"])
def load_model():
    """Load the model"""
    if s.production:
        abort(404)

    try:
        success = s.controller.load_model(s.model_alias)
        if success:
            return jsonify({"message": f"Model {s.model_alias} loaded successfully"})
        else:
            return jsonify({"error": f"Failed to load model {s.model_alias}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/model/unload", methods=["POST"])
def unload_model():
    """Unload the model"""
    if s.production:
        abort(404)

    try:
        success = s.controller.unload_model(s.model_alias)
        if success:
            return jsonify({"message": f"Model {s.model_alias} unloaded successfully"})
        else:
            return jsonify({"error": f"Failed to unload model {s.model_alias}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/model/status")
def model_status():
    """Get status of the model"""

    try:
        status = s.controller.get_model_status(s.model_alias)
        status_text = {0: "UNLOADED", 1: "LOADING", 2: "LOADED"}.get(status, "UNKNOWN")
        info = s.controller.get_model_info(s.model_alias)

        return jsonify({"alias": s.model_alias, "status": status_text, "info": info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/embeddings/generate", methods=["POST"])
def generate_embeddings():
    """Manually trigger embedding generation"""
    if s.production:
        abort(404)

    try:
        result = s.trigger_embedding_generation()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/api/embeddings/progress")
def get_embedding_progress():
    """Get current embedding generation progress"""
    if s.production:
        abort(404)

    try:
        progress = s.get_embedding_progress()
        return jsonify(progress)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@s.app.route("/image/<image_id>")
def serve_image(image_id):
    """Serve image files"""
    try:
        image_path = s.rc.hget(f"image:{image_id}", "local_path")
        if not image_path:
            s.server_log(f"[ERROR] Image not found in Redis: {image_id}")
            return jsonify({"error": "Image not found"}), 404

        image_path_str = image_path.decode("utf-8")

        if not os.path.exists(image_path_str):
            s.server_log(f"[ERROR] Image file not found on disk: {image_path_str}")
            return jsonify({"error": "Image file not found on disk"}), 404

        s.server_log(f"[INFO] Serving image: {image_path_str}")
        return send_from_directory(
            os.path.dirname(image_path_str),
            os.path.basename(image_path_str),
        )
    except Exception as e:
        s.server_log(f"[ERROR] Failed to serve image {image_id}: {e}")
        return jsonify({"error": f"Failed to serve image: {str(e)}"}), 500


@s.app.route("/api/image/<image_id>/details")
def get_image_details(image_id):
    """Get image metadata and associated document details"""
    try:
        if not s.rc:
            return jsonify({"error": "Redis not connected"}), 500

        image_data = s.rc.hgetall(f"image:{image_id}")
        if not image_data:
            return jsonify({"error": "Image not found"}), 404

        image_info = s.rc.decode_object(image_data)

        if image_info.get("hidden", "false") == "true":
            return jsonify({"error": "Image not found"}), 404

        document_keys = s.rc.keys("document:*")
        associated_documents = []

        if document_keys:
            pipe = s.rc.client.pipeline()
            for doc_key in document_keys:
                pipe.hget(doc_key, "images")
                pipe.hget(doc_key, "hidden")

            results = pipe.execute()

            for i, doc_key in enumerate(document_keys):
                images_json_bytes = results[i * 2]
                hidden_status = results[i * 2 + 1]

                if hidden_status:
                    hidden_value = (
                        hidden_status.decode("utf-8")
                        if isinstance(hidden_status, bytes)
                        else str(hidden_status)
                    )
                    if hidden_value == "true":
                        continue

                if images_json_bytes:
                    images_json = (
                        images_json_bytes.decode("utf-8")
                        if isinstance(images_json_bytes, bytes)
                        else images_json_bytes
                    )

                    try:
                        images = json.loads(images_json) if images_json else []

                        for img in images:
                            if isinstance(img, dict) and img.get("hash") == image_id:
                                doc_data = s.rc.hgetall(doc_key)
                                if doc_data:
                                    doc_info = s.rc.decode_object(doc_data)
                                    doc_key_str = (
                                        doc_key.decode("utf-8")
                                        if isinstance(doc_key, bytes)
                                        else str(doc_key)
                                    )
                                    doc_hash = (
                                        doc_key_str.split(":")[-1]
                                        if ":" in doc_key_str
                                        else doc_key_str
                                    )

                                    associated_documents.append(
                                        {
                                            "title": doc_info.get(
                                                "title", "Untitled Document"
                                            ),
                                            "content": doc_info.get("content", "")[:500]
                                            + (
                                                "..."
                                                if len(doc_info.get("content", ""))
                                                > 500
                                                else ""
                                            ),
                                            "url": doc_info.get("url", ""),
                                            "date": doc_info.get("date", ""),
                                            "hash": doc_hash,
                                        }
                                    )
                                break
                    except json.JSONDecodeError:
                        continue

        return jsonify(
            {
                "image": {
                    "hash": image_info.get("hash", image_id),
                    "url": image_info.get("url", ""),
                    "local_path": image_info.get("local_path", ""),
                    "extension": image_info.get("extension", ""),
                },
                "documents": associated_documents,
            }
        )

    except Exception as e:
        s.server_log(f"[ERROR] Failed to get image details for {image_id}: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    s.app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)