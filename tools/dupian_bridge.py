# -*- coding: utf-8 -*-
import sys
import json
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dupian

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command argument"}))
        return

    cmd = sys.argv[1]
    input_data = sys.stdin.read()
    if not input_data:
        print(json.dumps({"error": "Empty input"}))
        return

    try:
        payload = json.loads(input_data)
        text = payload.get("text", "")
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        return

    if cmd == "diagnose":
        m = dupian.metrics(text)
        score = dupian.human_score(text)
        hits = dupian.scan(text)
        formatted_hits = [
            {"rule": h[0], "action": h[1], "word": h[2], "snippet": h[3]}
            for h in hits
        ]
        result = {
            "metrics": m,
            "humanScore": score,
            "hits": formatted_hits,
            "hitCount": len(formatted_hits)
        }
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "repair":
        repaired, hits, logs = dupian.repair(text)
        formatted_hits = [
            {"rule": h[0], "action": h[1], "word": h[2], "snippet": h[3]}
            for h in hits
        ]
        result = {
            "cleanedText": repaired,
            "hits": formatted_hits,
            "logs": logs,
            "originalLength": len(text),
            "cleanedLength": len(repaired)
        }
        print(json.dumps(result, ensure_ascii=False))

    else:
        print(json.dumps({"error": f"Unknown command {cmd}"}))

if __name__ == "__main__":
    main()
