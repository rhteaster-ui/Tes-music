from fastapi import FastAPI, HTTPException, Query, Request
from ytmusicapi import YTMusic
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone
import os
import time
import uuid

app = FastAPI()

raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
if not allow_origins:
    raise RuntimeError("CORS_ALLOW_ORIGINS must define at least one origin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

ytmusic = YTMusic()
home_cache = {}
CACHE_TTL = 3600
SEARCH_TIMEOUT_SECONDS = float(os.getenv("YT_SEARCH_TIMEOUT_SECONDS", "8"))
executor = ThreadPoolExecutor(max_workers=4)


def utc_timestamp():
    return datetime.now(timezone.utc).isoformat()


def json_error(status_code: int, error_code: str, message: str, trace_id: str):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "error_code": error_code,
            "message": message,
            "trace_id": trace_id,
            "timestamp": utc_timestamp(),
        },
    )


def yt_search_with_timeout(query: str, limit: int):
    future = executor.submit(ytmusic.search, query, "songs", limit)
    try:
        return future.result(timeout=SEARCH_TIMEOUT_SECONDS)
    except FuturesTimeoutError as exc:
        future.cancel()
        raise TimeoutError("YTMusic upstream timeout") from exc


def format_results(search_results):
    cleaned_results = []
    for item in search_results:
        if "videoId" in item:
            cleaned_results.append(
                {
                    "videoId": item["videoId"],
                    "title": item.get("title", "Unknown Title"),
                    "artist": item.get("artists", [{"name": "Unknown Artist"}])[0]["name"] if "artists" in item else "Unknown Artist",
                    "thumbnail": item["thumbnails"][-1]["url"] if "thumbnails" in item else "",
                }
            )
    return cleaned_results


@app.get("/api/search")
def search_music(request: Request, query: str = Query(..., min_length=2, max_length=100)):
    trace_id = request.headers.get("x-correlation-id", str(uuid.uuid4()))
    try:
        search_results = yt_search_with_timeout(query.strip(), 15)
        return {
            "status": "success",
            "data": format_results(search_results),
            "trace_id": trace_id,
            "timestamp": utc_timestamp(),
        }
    except TimeoutError:
        return json_error(504, "UPSTREAM_TIMEOUT", "Layanan musik sedang lambat. Coba lagi sebentar.", trace_id)
    except Exception:
        return json_error(500, "SEARCH_FAILED", "Terjadi gangguan saat mencari lagu.", trace_id)


@app.get("/api/home")
def get_home_data(request: Request):
    trace_id = request.headers.get("x-correlation-id", str(uuid.uuid4()))
    current_time = time.time()
    if "data" in home_cache and (current_time - home_cache["timestamp"] < CACHE_TTL):
        return {"status": "success", "data": home_cache["data"], "trace_id": trace_id, "timestamp": utc_timestamp()}

    try:
        data = {
            "recent": format_results(yt_search_with_timeout("lagu hits indonesia 2025", 6)),
            "trending": format_results(yt_search_with_timeout("trending music indonesia", 10)),
            "chill": format_results(yt_search_with_timeout("lagu santai cafe indonesia", 10)),
            "galau": format_results(yt_search_with_timeout("lagu galau indonesia terbaik", 10)),
        }
        home_cache["data"] = data
        home_cache["timestamp"] = current_time
        return {"status": "success", "data": data, "trace_id": trace_id, "timestamp": utc_timestamp()}
    except TimeoutError:
        return json_error(504, "UPSTREAM_TIMEOUT", "Layanan musik sedang lambat. Coba lagi sebentar.", trace_id)
    except Exception:
        return json_error(500, "HOME_FETCH_FAILED", "Gagal memuat data beranda.", trace_id)
