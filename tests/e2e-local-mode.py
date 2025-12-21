#!/usr/bin/env python3
"""Test OmniScribe in pure local/web mode (no cloud)"""

from playwright.sync_api import sync_playwright

def main():
    print("=" * 50)
    print("TESTING LOCAL-ONLY MODE")
    print("=" * 50)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()
        
        errors = []
        warnings = []
        
        def handle_console(msg):
            if msg.type == 'error':
                errors.append(msg.text)
                print(f"[ERROR] {msg.text}")
            elif msg.type == 'warning':
                warnings.append(msg.text)
                if 'supabase' in msg.text.lower() or 'cloud' in msg.text.lower():
                    print(f"[WARN] {msg.text}")
        
        page.on('console', handle_console)
        
        # Test without Supabase (simulating local-only)
        print("\n[1] Loading app...")
        page.goto('https://omniscribe.vercel.app', wait_until='networkidle')
        page.wait_for_timeout(2000)
        
        # Check console for cloud status
        print("\n[2] Checking cloud/local mode detection...")
        
        # Go to settings to see sync status
        settings_btn = page.locator('header button').last
        settings_btn.click()
        page.wait_for_timeout(500)
        
        settings_text = page.locator('body').inner_text()
        
        if 'Supabase Sync' in settings_text:
            if 'Connected' in settings_text:
                print("  - Cloud mode: Supabase connected")
            else:
                print("  - Local mode: Supabase not connected")
        
        # Check for Gemini API key requirement
        print("\n[3] Checking local transcription capability...")
        
        # The geminiService requires VITE_GEMINI_API_KEY
        # In production build, this would be baked in at build time
        
        page.screenshot(path='/tmp/local-mode-settings.png')
        
        # Close settings
        close_btn = page.locator('button').first
        close_btn.click()
        page.wait_for_timeout(300)
        
        # Try opening recorder
        print("\n[4] Testing recorder opens locally...")
        page.locator('nav button').nth(2).click()
        page.wait_for_timeout(1000)
        
        body_text = page.locator('body').inner_text()
        if 'REC' in body_text and 'Raw' in body_text:
            print("  ✓ Recorder UI works")
        else:
            print("  ✗ Recorder UI failed")
        
        page.screenshot(path='/tmp/local-mode-recorder.png')
        
        # Summary
        print("\n" + "=" * 50)
        print("LOCAL MODE ANALYSIS")
        print("=" * 50)
        
        cloud_errors = [e for e in errors if 'supabase' in e.lower() or 'cloud' in e.lower() or 'sync' in e.lower()]
        gemini_errors = [e for e in errors if 'gemini' in e.lower() or 'api' in e.lower()]
        
        print(f"\nCloud-related errors: {len(cloud_errors)}")
        for e in cloud_errors:
            print(f"  - {e[:100]}")
        
        print(f"\nGemini API errors: {len(gemini_errors)}")
        for e in gemini_errors:
            print(f"  - {e[:100]}")
        
        print(f"\nTotal console errors: {len(errors)}")
        print(f"Total console warnings: {len(warnings)}")
        
        browser.close()

if __name__ == '__main__':
    main()
