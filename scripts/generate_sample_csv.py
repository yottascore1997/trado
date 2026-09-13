import csv
import os
import random
from datetime import datetime, timedelta, time
import pytz

IST = pytz.timezone("Asia/Kolkata")
SESSION_START = time(9, 15)
SESSION_END = time(15, 30)


def generate_sample_csv(
    file_path: str,
    symbol: str = "NIFTY 50",
    days: int = 5,
    start_price: float = 25100.0,
):
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)

    # Base date
    base_date = datetime(2026, 1, 5, tzinfo=IST)  # A Monday

    rows = []
    current_price = start_price
    volatility = 0.0007 if "BANK" not in symbol else 0.0011

    for day_offset in range(days):
        day = base_date + timedelta(days=day_offset)
        if day.weekday() >= 5:
            continue

        # Generate each minute from 09:15 to 15:30
        curr_time = datetime.combine(day.date(), SESSION_START, tzinfo=IST)
        end_time = datetime.combine(day.date(), SESSION_END, tzinfo=IST)

        while curr_time <= end_time:
            # Random price movement
            change = random.gauss(0, volatility)
            close_p = round(round(current_price * (1 + change) / 0.05) * 0.05, 2)
            high_p = round(max(current_price, close_p) + random.uniform(2.0, 10.0), 2)
            low_p = round(min(current_price, close_p) - random.uniform(2.0, 10.0), 2)
            volume = random.randint(30000, 150000)

            rows.append({
                "timestamp": curr_time.strftime("%Y-%m-%d %H:%M:%S"),
                "open": current_price,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": volume,
                "instrument": symbol,
            })

            current_price = close_p
            curr_time += timedelta(minutes=1)

    with open(file_path, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["timestamp", "open", "high", "low", "close", "volume", "instrument"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} sample 1-minute rows at: {file_path}")


if __name__ == "__main__":
    generate_sample_csv("data/sample_nifty_1m.csv", "NIFTY 50", days=3, start_price=25100.0)
    generate_sample_csv("data/sample_banknifty_1m.csv", "BANK NIFTY", days=3, start_price=51800.0)
