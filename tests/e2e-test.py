#!/usr/bin/env python3
"""E2E test for OmniScribe - captures console logs and errors"""

from playwright.sync_api import sync_playwright
import json

def main():
    console_logs = []
    network_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            permissions=['microphone'],  # Grant mic permissions
            viewport={'width': 390, 'height': 844}  # iPhone 12 Pro size
        )
        page = context.new_page()
        
        # Capture console logs
        def handle_console(msg):
            log_entry = {
                'type': msg.type,
                'text': msg.text,
                'location': str(msg.location) if msg.location else None
            }
            console_logs.append(log_entry)
            print(f"[CONSOLE {msg.type.upper()}] {msg.text}")
        
        page.on('console', handle_console)
        
        # Capture page errors
        def handle_error(error):
            print(f"[PAGE ERROR] {error}")
            network_errors.append(str(error))
        
        page.on('pageerror', handle_error)
        
        # Capture failed requests
        def handle_request_failed(request):
            error_text = f"Failed: {request.url} - {request.failure}"
            print(f"[REQUEST FAILED] {error_text}")
            network_errors.append(error_text)
        
        page.on('requestfailed', handle_request_failed)
        
        # Navigate to the app
        print("\n=== NAVIGATING TO OMNISCRIBE ===")
        page.goto('https://omniscribe.vercel.app', wait_until='networkidle', timeout=30000)
        
        # Wait for app to fully load
        page.wait_for_timeout(2000)
        
        # Take initial screenshot
        page.screenshot(path='/tmp/omniscribe-home.png', full_page=True)
        print("Screenshot saved: /tmp/omniscribe-home.png")
        
        # Check what's visible on the page
        print("\n=== PAGE CONTENT ANALYSIS ===")
        
        # Get page title
        title = page.title()
        print(f"Page title: {title}")
        
        # Find key elements
        print("\n--- Looking for key UI elements ---")
        
        # Check for header
        header = page.locator('header').first
        if header.is_visible():
            print("✓ Header found")
        
        # Check for recording button
        record_buttons = page.locator('button:has-text("record"), button:has-text("Record"), [class*="record"]').all()
        print(f"Record buttons found: {len(record_buttons)}")
        
        # Check for mic icon button
        mic_buttons = page.locator('button svg, button:has(svg)').all()
        print(f"Buttons with icons: {len(mic_buttons)}")
        
        # Check for tab bar
        tab_buttons = page.locator('nav button, [role="tablist"] button').all()
        print(f"Tab/nav buttons: {len(tab_buttons)}")
        
        # Try to find the main recording trigger
        main_buttons = page.locator('button').all()
        print(f"Total buttons on page: {len(main_buttons)}")
        
        # Print visible text content
        print("\n--- Visible text on page ---")
        body_text = page.locator('body').inner_text()
        # Print first 500 chars
        print(body_text[:500] if len(body_text) > 500 else body_text)
        
        # Try clicking the record button (center button in tab bar)
        print("\n=== TESTING RECORD BUTTON ===")
        try:
            # Look for the center button that triggers recording
            record_btn = page.locator('button:has(svg)').nth(2)  # Usually center button
            if record_btn.is_visible():
                print("Clicking record button...")
                record_btn.click()
                page.wait_for_timeout(1500)
                page.screenshot(path='/tmp/omniscribe-recording.png', full_page=True)
                print("Screenshot saved: /tmp/omniscribe-recording.png")
        except Exception as e:
            print(f"Could not click record button: {e}")
        
        # Check API endpoint
        print("\n=== TESTING API ENDPOINT ===")
        api_page = context.new_page()
        response = api_page.goto('https://omniscribe.vercel.app/api/notes')
        print(f"API /notes response status: {response.status}")
        if response.status == 200:
            try:
                api_data = response.json()
                print(f"API response: {json.dumps(api_data, indent=2)[:500]}")
            except:
                print(f"API response text: {response.text()[:500]}")
        api_page.close()
        
        # Summary
        print("\n=== SUMMARY ===")
        errors = [log for log in console_logs if log['type'] == 'error']
        warnings = [log for log in console_logs if log['type'] == 'warning']
        print(f"Console errors: {len(errors)}")
        print(f"Console warnings: {len(warnings)}")
        print(f"Network errors: {len(network_errors)}")
        
        if errors:
            print("\n--- ERRORS DETAIL ---")
            for err in errors:
                print(f"  - {err['text']}")
        
        if network_errors:
            print("\n--- NETWORK ERRORS DETAIL ---")
            for err in network_errors:
                print(f"  - {err}")
        
        browser.close()

if __name__ == '__main__':
    main()
