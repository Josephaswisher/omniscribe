#!/usr/bin/env python3
"""E2E test for OmniScribe recording flow"""

from playwright.sync_api import sync_playwright
import json

def main():
    console_logs = []
    network_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            permissions=['microphone'],
            viewport={'width': 390, 'height': 844}
        )
        page = context.new_page()
        
        # Capture console logs
        def handle_console(msg):
            log_entry = {
                'type': msg.type,
                'text': msg.text,
            }
            console_logs.append(log_entry)
            if msg.type in ['error', 'warning']:
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
        print("=== LOADING OMNISCRIBE ===")
        page.goto('https://omniscribe.vercel.app', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)
        
        # Find the microphone/record button (the center elevated button in the tab bar)
        print("\n=== FINDING RECORD BUTTON ===")
        
        # The mic button has a gradient background and is in the center
        # Looking at the screenshot, it's the button with the microphone icon
        mic_button = page.locator('nav button').nth(2)  # Center button (index 2 of 5)
        
        if mic_button.is_visible():
            print("✓ Found record button in tab bar")
            
            # Check its appearance
            button_box = mic_button.bounding_box()
            print(f"  Position: x={button_box['x']:.0f}, y={button_box['y']:.0f}")
            print(f"  Size: {button_box['width']:.0f}x{button_box['height']:.0f}")
            
            # Click to start recording
            print("\n=== STARTING RECORDING ===")
            mic_button.click()
            page.wait_for_timeout(2000)
            
            # Take screenshot of recording UI
            page.screenshot(path='/tmp/omniscribe-recorder-opened.png', full_page=True)
            print("Screenshot: /tmp/omniscribe-recorder-opened.png")
            
            # Check what's visible now
            body_text = page.locator('body').inner_text()
            print(f"\n--- Recording UI text ---")
            print(body_text[:800])
            
            # Look for recording controls
            print("\n=== CHECKING RECORDING STATE ===")
            
            # Check if REC indicator is visible
            rec_indicator = page.locator('text=REC').first
            if rec_indicator.is_visible():
                print("✓ REC indicator visible - recording started")
            else:
                print("✗ REC indicator not found")
            
            # Check for timer
            timer = page.locator('text=/\\d+:\\d+/').first
            if timer.is_visible():
                print(f"✓ Timer visible: {timer.inner_text()}")
            else:
                print("✗ Timer not found")
            
            # Check for pause button
            pause_btns = page.locator('button:has(svg)').all()
            print(f"  Control buttons visible: {len(pause_btns)}")
            
            # Wait a bit to let it record
            print("\n=== RECORDING FOR 3 SECONDS ===")
            page.wait_for_timeout(3000)
            page.screenshot(path='/tmp/omniscribe-recording-3s.png', full_page=True)
            print("Screenshot: /tmp/omniscribe-recording-3s.png")
            
            # Try to stop recording by clicking the green check button
            print("\n=== STOPPING RECORDING ===")
            # The green check button should be on the right
            stop_btn = page.locator('button').last
            if stop_btn.is_visible():
                stop_btn.click()
                print("Clicked stop button")
                page.wait_for_timeout(5000)  # Wait for processing
                
                page.screenshot(path='/tmp/omniscribe-after-stop.png', full_page=True)
                print("Screenshot: /tmp/omniscribe-after-stop.png")
        else:
            print("✗ Could not find record button")
        
        # Final summary
        print("\n=== FINAL SUMMARY ===")
        errors = [log for log in console_logs if log['type'] == 'error']
        warnings = [log for log in console_logs if log['type'] == 'warning']
        print(f"Console errors: {len(errors)}")
        print(f"Console warnings: {len(warnings)}")
        print(f"Network errors: {len(network_errors)}")
        
        if errors:
            print("\n--- ERRORS ---")
            for err in errors[:10]:  # First 10 errors
                print(f"  {err['text'][:200]}")
        
        browser.close()

if __name__ == '__main__':
    main()
