# API

Base path `/api`. JSON in and out. Errors use `{ statusCode, message, error }`; validation errors return `400` with `message` as a list. Unknown fields are rejected.

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ status, db, redis }`; `503` when a dependency is down |
| GET | `/posts?page=&limit=&category=&tag=&q=` | Published posts, newest first. `limit` ≤ 50. `category`/`tag` are slugs, `q` searches titles. Cached 60 s |
| GET | `/posts/:slug` | Published post with `content`. Cached 300 s. `404` for drafts |
| GET | `/posts/:slug/comments` | Approved comments, oldest first |
| POST | `/posts/:slug/comments` | `{ authorName ≤ 60, content ≤ 2000 }` → `201 { id, status: "PENDING" }`. 3/min per IP |
| GET | `/categories`, `/tags` | `{ id, name, slug }[]` |

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, user }` and sets the `refresh_token` cookie (httpOnly, `SameSite=Strict`, path `/api/auth`, 7 days). 5/min per IP |
| POST | `/auth/refresh` | Uses the cookie → `{ accessToken }` and a new cookie. Reusing an old refresh token revokes all sessions of the user |
| POST | `/auth/logout` | `204`, revokes the refresh token |
| GET | `/auth/me` | `Authorization: Bearer <accessToken>` → user |

Access tokens are valid for 15 minutes.

## Admin (`Authorization: Bearer`, role `ADMIN`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/posts?page=&limit=&status=` | All posts with `status`, `createdAt`, `updatedAt` |
| GET | `/admin/posts/:id` | |
| POST | `/admin/posts` | `{ title, content, slug?, excerpt?, coverImageUrl?, status?, categoryId?, tagIds? }`. Slug is generated from the title when omitted and made unique with `-2`, `-3`… |
| PATCH | `/admin/posts/:id` | Any subset of the fields above; `categoryId: null` removes the category. `publishedAt` is set on first publish |
| DELETE | `/admin/posts/:id` | `204` |
| POST / PATCH / DELETE | `/admin/categories[/:id]`, `/admin/tags[/:id]` | `{ name, slug? }`; duplicate name or slug → `409`. Deleting a category keeps its posts uncategorized |
| GET | `/admin/comments?page=&limit=&status=` | Includes `status`, `postId`, `post { title, slug }` |
| PATCH | `/admin/comments/:id` | `{ status: "PENDING" \| "APPROVED" \| "REJECTED" }` |
| DELETE | `/admin/comments/:id` | `204` |
| POST | `/admin/uploads` | `multipart/form-data` field `file` (JPEG/PNG/WebP/GIF, ≤ 5 MB, detected from content) → `201 { url: "/uploads/<uuid>.<ext>" }` |

Any write to posts, categories or tags clears the public post cache.
