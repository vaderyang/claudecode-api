#!/usr/bin/env python3
"""
Simple greeting script that displays a greeting and current date.
"""

from datetime import datetime

def main():
    # Print greeting
    print("Hello! Welcome to Python!")
    
    # Get and print current date
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"Today's date and time: {current_date}")

if __name__ == "__main__":
    main()