# Optimistic Creation Strategy (Instant Navigation & Lazy Hydration)

This document outlines the standard pattern for creating new items in Xeenaps to ensure a **Zero-Latency** user experience.

## 1. Philosophy
Traditional creation flows often wait for server responses (e.g., fetching a user profile or generating an ID) before navigating to the detail/edit page. This introduces a perceptible delay (200ms - 1s) that makes the app feel sluggish.

**Optimistic Creation** reverses this:
1.  **Navigate Immediately**: Use a generated ID and a local "Draft" state to switch views instantly (< 10ms).
2.  **Lazy Hydrate**: Once the destination view is mounted, fetch necessary data (like user profiles or defaults) in the background and update the state seamlessly.

## 2. Implementation Steps

### A. List View (Parent) - Example: `AllPublication.tsx`
*   **Do NOT** await async operations before navigation.
*   Generate a UUID locally (`crypto.randomUUID()`).
*   Create a skeleton/draft object with empty or default values.
*   Navigate immediately using `state`.

**Before (Slow):**
```typescript
const handleNew = async () => {
  const profile = await fetchProfile(); // BLOCKS NAVIGATION
  navigate('/detail', { state: { author: profile.name } });
};
```

**After (Instant):**
```typescript
const handleNew = () => {
  const id = crypto.randomUUID();
  const newItem = { 
    id, 
    authors: [], // Initialize empty
    status: 'Draft',
    // ...other defaults
  };
  
  // NAVIGATE IMMEDIATELY
  navigate(`/detail/${id}`, { state: { item: newItem, isNew: true } });
};
```

### B. Detail View (Child) - Example: `PublicationDetail.tsx`
*   Initialize state from `location.state`.
*   Use `useEffect` to check if it's a new item (`isNew` flag) and if specific data is missing.
*   Fetch data in the background and update the state silently.

**Pattern:**
```typescript
const [item, setItem] = useState(location.state?.item || null);

useEffect(() => {
  const hydrate = async () => {
    const isNewDraft = location.state?.isNew;
    
    // Condition: New draft AND data missing (e.g., authors empty)
    if (isNewDraft && item && (!item.authors || item.authors.length === 0)) {
      try {
        // Fetch data in background
        const profileName = await getCleanedProfileName();
        if (profileName) {
          // Update state without blocking UI
          setItem(prev => prev ? { ...prev, authors: [profileName] } : null);
        }
      } catch (e) {
        console.error("Hydration failed", e);
      }
    }
  };
  
  hydrate();
}, []);
```

## 3. Benefits
*   **Perceived Performance**: The app feels instantaneous to the user.
*   **Reliability**: Navigation happens regardless of network status or latency.
*   **User Focus**: Users can start typing titles or other fields immediately while secondary data (like profile names) loads in the background.

## 4. Key Considerations
*   **State Persistence**: Ensure the "Save" logic in the Detail view handles both *Creating* (if ID doesn't exist in DB) and *Updating* operations seamlessly.
*   **Dirty Flags**: If you use a dirty flag for unsaved changes, consider whether the lazy hydration update should trigger it. Usually, auto-filled data shouldn't block the user from leaving if they haven't made manual edits.
