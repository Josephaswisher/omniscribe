#!/usr/bin/env python3
"""Full E2E test for OmniScribe - tests all non-microphone features"""

from playwright.sync_api import sync_playwright
import json

def main():
    errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()
        
        # Capture errors
        page.on('pageerror', lambda e: errors.append(f"PAGE: {e}"))
        page.on('requestfailed', lambda r: errors.append(f"REQUEST: {r.url} - {r.failure}"))
        
        print("=" * 50)
        print("OMNISCRIBE E2E TEST SUITE")
        print("=" * 50)
        
        # 1. Load app
        print("\n[TEST 1] Load App")
        page.goto('https://omniscribe.vercel.app', wait_until='networkidle')
        page.wait_for_timeout(1000)
        assert page.title() == 'OmniScribe V2', f"Expected title 'OmniScribe V2', got '{page.title()}'"
        print("  ✓ App loads correctly")
        
        # 2. Test Home view
        print("\n[TEST 2] Home View")
        home_text = page.locator('body').inner_text()
        assert 'No recordings yet' in home_text, "Expected 'No recordings yet' text"
        print("  ✓ Home view shows empty state")
        
        # 3. Test Folders tab
        print("\n[TEST 3] Folders Tab")
        page.locator('nav button').nth(1).click()  # Folders tab
        page.wait_for_timeout(500)
        folders_text = page.locator('body').inner_text()
        assert 'Folders' in folders_text, "Expected 'Folders' header"
        assert 'Personal' in folders_text, "Expected 'Personal' folder"
        assert 'Work' in folders_text, "Expected 'Work' folder"
        assert 'Ideas' in folders_text, "Expected 'Ideas' folder"
        print("  ✓ Folders view displays correctly")
        page.screenshot(path='/tmp/test-folders.png')
        
        # 4. Test Search tab
        print("\n[TEST 4] Search Tab")
        page.locator('nav button').nth(3).click()  # Search tab
        page.wait_for_timeout(500)
        search_text = page.locator('body').inner_text()
        assert 'Search' in search_text, "Expected 'Search' in view"
        print("  ✓ Search view loads")
        page.screenshot(path='/tmp/test-search.png')
        
        # 5. Test Actions tab
        print("\n[TEST 5] Actions Tab")
        page.locator('nav button').nth(4).click()  # Actions tab
        page.wait_for_timeout(500)
        actions_text = page.locator('body').inner_text()
        assert 'Actions' in actions_text or 'action' in actions_text.lower(), "Expected Actions view"
        print("  ✓ Actions view loads")
        page.screenshot(path='/tmp/test-actions.png')
        
        # 6. Test Settings
        print("\n[TEST 6] Settings")
        settings_btn = page.locator('header button').last
        settings_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path='/tmp/test-settings.png')
        settings_text = page.locator('body').inner_text()
        assert 'Settings' in settings_text, "Expected 'Settings' header"
        print("  ✓ Settings view loads")
        
        # Go back
        back_btn = page.locator('button:has(svg)').first
        back_btn.click()
        page.wait_for_timeout(500)
        
        # 7. Test API endpoints
        print("\n[TEST 7] API Endpoints")
        
        # Test /api/notes
        api_page = context.new_page()
        notes_response = api_page.goto('https://omniscribe.vercel.app/api/notes')
        assert notes_response.status == 200, f"Expected 200, got {notes_response.status}"
        notes_data = notes_response.json()
        assert 'notes' in notes_data, "Expected 'notes' key in response"
        print(f"  ✓ GET /api/notes - 200 OK ({len(notes_data['notes'])} notes)")
        
        # Test /api/parsers
        parsers_response = api_page.goto('https://omniscribe.vercel.app/api/parsers')
        assert parsers_response.status == 200, f"Expected 200, got {parsers_response.status}"
        parsers_data = parsers_response.json()
        assert 'parsers' in parsers_data, "Expected 'parsers' key in response"
        print(f"  ✓ GET /api/parsers - 200 OK ({len(parsers_data['parsers'])} parsers)")
        api_page.close()
        
        # 8. Test Record UI opens
        print("\n[TEST 8] Record UI")
        page.locator('nav button').nth(0).click()  # Go home first
        page.wait_for_timeout(300)
        page.locator('nav button').nth(2).click()  # Record button
        page.wait_for_timeout(1000)
        rec_text = page.locator('body').inner_text()
        assert 'REC' in rec_text, "Expected 'REC' indicator"
        assert 'Raw' in rec_text, "Expected parser options"
        print("  ✓ Record UI opens correctly")
        page.screenshot(path='/tmp/test-record-ui.png')
        
        # Close recorder
        close_btn = page.locator('button:has(svg)').first
        close_btn.click()
        page.wait_for_timeout(500)
        
        # Summary
        print("\n" + "=" * 50)
        print("TEST RESULTS")
        print("=" * 50)
        
        if errors:
            print(f"\n❌ ERRORS FOUND: {len(errors)}")
            for err in errors:
                print(f"  - {err[:100]}")
        else:
            print("\n✅ ALL TESTS PASSED")
        
        print("\nScreenshots saved to /tmp/test-*.png")
        
        browser.close()

if __name__ == '__main__':
    main()
