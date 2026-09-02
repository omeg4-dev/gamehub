"""A phone made of a JSON file.

Opens the real socket on the real server and replays a captured trace, so
the whole path -- socket, controller, pointer, broadcast -- is exercised
with nothing plugged in.
"""
import json


async def replay(client, token, trace_path, limit=None):
    frames = json.loads(trace_path.read_text())[:limit]
    async with client.ws_connect(f"/{token}/ws/phone") as phone:
        await phone.receive_json(timeout=2)
        for frame in frames:
            await phone.send_json({"type": "frame", **frame})
    return len(frames)
