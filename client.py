import argparse
from pathlib import Path
import requests


def main():
    parser = argparse.ArgumentParser(description="DCN-LINK Wi-Fi sender client")
    parser.add_argument("--ip", required=True, help="Receiver IPv4 address")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--file", help="Path of a file to send")
    parser.add_argument("--text", help="Text message to send")
    args = parser.parse_args()

    if bool(args.file) == bool(args.text):
        parser.error("Provide exactly one of --file or --text")

    url = f"http://{args.ip}:{args.port}/api/upload"
    data = {"medium": "Wi-Fi", "protocol": "HTTP"}

    try:
        if args.text is not None:
            data["type"] = "text"
            data["text"] = args.text
            response = requests.post(url, data=data, timeout=60)
        else:
            path = Path(args.file)
            if not path.is_file():
                raise FileNotFoundError(path)
            data["type"] = "file"
            with path.open("rb") as stream:
                response = requests.post(
                    url,
                    data=data,
                    files={"files": (path.name, stream)},
                    timeout=300
                )

        print("HTTP status:", response.status_code)
        print(response.json())
        response.raise_for_status()

    except requests.RequestException as exc:
        print("Transfer failed:", exc)
    except OSError as exc:
        print("File error:", exc)


if __name__ == "__main__":
    main()
