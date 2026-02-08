# Requirements Document

## Introduction

The Admin & Roles System formalizes role-based access control for the DAATAN prediction platform. The current implementation uses boolean flags (`isAdmin`, `isModerator`) on the User model and ad-hoc checks scattered across routes. This feature replaces those booleans with a proper `Role` enum (`USER`, `RESOLVER`, `ADMIN`), introduces standardized role-based API middleware, enhances the admin panel with edit/soft-delete capabilities for forecasts, and adds inline moderation controls (resolve predictions, delete comments) for resolvers. UI badges on profiles indicate elevated roles.

## Glossary

- **Platform**: The DAATAN prediction platform (Next.js 14 application)
- **Role_Enum**: A Prisma enum with values `USER`, `RESOLVER`, `ADMIN`
- **User_Model**: The Prisma `User` model representing a platform user
- **Admin**: A user with `role = ADMIN`; full platform management access
- **Resolver**: A user with `role = RESOLVER`; can resolve predictions and delete comments
- **Regular_User**: A user with `role = USER`; standard platform access
- **Admin_Panel**: The `/admin` page providing management interfaces for forecasts, comments, and users
- **Role_Middleware**: Server-side utility that checks the requesting user's role before allowing access to a route
- **Inline_Moderation_Controls**: UI elements rendered within prediction and comment views that allow resolvers and admins to take moderation actions without navigating to the admin panel
- **Soft_Delete**: Marking a record with a `deletedAt` timestamp rather than physically removing it from the database
- **Role_Badge**: A visual indicator (pill/tag) displayed on a user's profile or comment showing their role

## Requirements

### Requirement 1: Role Enum Migration

**User Story:** As a platform developer, I want a single `role` enum field on the User model replacing the boolean flags, so that role logic is centralized and extensible.

#### Acceptance Criteria

1. THE Platform SHALL define a `Role` enum in the Prisma schema with values `USER`, `RESOLVER`, `ADMIN`
2. THE Platform SHALL add a `role` field of type `Role_Enum` to the User_Model with a default value of `USER`
3. WHEN the migration runs, THE Platform SHALL map existing users with `isAdmin = true` to `role = ADMIN`, users with `isModerator = true` to `role = RESOLVER`, and all remaining users to `role = USER`
4. WHEN the migration completes, THE Platform SHALL remove the `isAdmin` and `isModerator` boolean fields from the User_Model
5. THE Platform SHALL update the NextAuth session callback to expose the `role` field instead of `isAdmin` and `isModerator`

### Requirement 2: Role-Based API Middleware

**User Story:** As a platform developer, I want a standardized middleware function for role-based route protection, so that authorization checks are consistent and easy to apply.

#### Acceptance Criteria

1. THE Role_Middleware SHALL accept a list of allowed roles and return the authenticated user when authorized
2. WHEN an unauthenticated request reaches a protected route, THE Role_Middleware SHALL return a 401 status with an error message
3. WHEN an authenticated user with an insufficient role reaches a protected route, THE Role_Middleware SHALL return a 403 status with an error message
4. THE Platform SHALL replace all existing ad-hoc role checks in API routes with the standardized Role_Middleware
5. WHEN the Role_Middleware validates a request, THE Role_Middleware SHALL query the user's current role from the database rather than relying solely on session data

### Requirement 3: Admin Forecasts Management

**User Story:** As an admin, I want to manage forecasts from the admin panel, so that I can search, edit, and soft-delete forecasts.

#### Acceptance Criteria

1. WHEN an admin views the forecasts tab, THE Admin_Panel SHALL display a paginated list of forecasts with search and status filtering
2. WHEN an admin edits a forecast, THE Admin_Panel SHALL allow modification of the claim text, details text, domain, and resolution rules
3. WHEN an admin soft-deletes a forecast, THE Platform SHALL set a `deletedAt` timestamp on the Prediction record rather than physically removing it
4. WHEN a prediction has a non-null `deletedAt` value, THE Platform SHALL exclude that prediction from public-facing queries
5. IF an admin attempts to edit a forecast that has already been resolved, THEN THE Platform SHALL reject the edit and return an error message

### Requirement 4: Admin Comments Management

**User Story:** As an admin, I want to manage comments from the admin panel, so that I can search and delete inappropriate comments.

#### Acceptance Criteria

1. WHEN an admin views the comments tab, THE Admin_Panel SHALL display a paginated list of comments with search and a toggle to show deleted comments
2. WHEN an admin deletes a comment, THE Platform SHALL soft-delete the comment by setting a `deletedAt` timestamp
3. WHEN a comment has a non-null `deletedAt` value, THE Platform SHALL display the comment as "[deleted]" in public views while preserving the thread structure

### Requirement 5: Admin Users Management

**User Story:** As an admin, I want to manage users and their roles from the admin panel, so that I can assign or revoke roles.

#### Acceptance Criteria

1. WHEN an admin views the users tab, THE Admin_Panel SHALL display a paginated list of users with search by name, email, or username
2. WHEN an admin assigns a role to a user, THE Platform SHALL update the user's `role` field to the selected value
3. WHEN an admin attempts to change their own role, THE Platform SHALL reject the request and return an error message
4. WHEN a role change is saved, THE Platform SHALL reflect the updated role in the user's next session refresh

### Requirement 6: Resolver Capabilities

**User Story:** As a resolver, I want to resolve predictions and delete comments from both inline UI and the admin panel, so that I can moderate content efficiently.

#### Acceptance Criteria

1. WHEN a resolver views an active or pending prediction, THE Inline_Moderation_Controls SHALL display a resolution form allowing the resolver to mark the prediction as correct, wrong, void, or unresolvable
2. WHEN a resolver views a comment, THE Inline_Moderation_Controls SHALL display a delete button allowing the resolver to soft-delete the comment
3. WHEN a resolver accesses the admin panel, THE Admin_Panel SHALL display the forecasts and comments tabs but hide the users tab
4. WHEN a resolver attempts to access an admin-only route, THE Role_Middleware SHALL return a 403 status

### Requirement 7: Role Badges on Profiles

**User Story:** As a user, I want to see role badges on profiles and comments, so that I can identify admins and resolvers.

#### Acceptance Criteria

1. WHEN displaying a user with `role = ADMIN`, THE Platform SHALL render an "Admin" badge next to the user's name
2. WHEN displaying a user with `role = RESOLVER`, THE Platform SHALL render a "Resolver" badge next to the user's name
3. WHEN displaying a user with `role = USER`, THE Platform SHALL render no role badge
4. THE Platform SHALL display role badges consistently on profile pages, comment authors, and prediction authors

### Requirement 8: Seed Initial Admins

**User Story:** As a platform operator, I want to seed initial admin users, so that the platform has administrators from the start.

#### Acceptance Criteria

1. THE Platform SHALL provide a seed script that sets specified users to `role = ADMIN` based on a configurable list of email addresses
2. WHEN the seed script runs against a database with existing users, THE Platform SHALL update matching users' roles without affecting other user data
3. IF a specified email does not match any existing user, THEN THE Platform SHALL log a warning and continue processing remaining emails
