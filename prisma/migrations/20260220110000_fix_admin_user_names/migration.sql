-- Fix admin users whose name was set to the seed placeholder 'Admin User'.
-- Replace with the local part of their email so the UI shows something meaningful
-- until they log in via Google and get their real name from OAuth.
UPDATE users
SET name = split_part(email, '@', 1)
WHERE role = 'ADMIN'
  AND name = 'Admin User';
