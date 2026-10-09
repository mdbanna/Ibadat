# Storage buckets (all private)

| Bucket | Max size | Types | Read | Write |
|---|---|---|---|---|
| `gallery` | 5 MB | jpeg, png, webp | whoever can read the matching `gallery_images` row (published + public/members) | editor (insert/update), admin (delete) |
| `member-photos` | 2 MB | jpeg, png, webp | owner folder; admin; everyone only while the profile is active + approved public | owner folder `<user_id>/...` |
| `documents` | 10 MB | pdf, jpeg, png | whoever can read the matching `documents` row | editor, admin (delete) |
| `beneficiary-files` | 10 MB | pdf, jpeg, png | admin only | admin only |
| `payment-receipts` | 5 MB | pdf, jpeg, png, webp | owner folder + treasurer/admin | owner folder, treasurer/admin; never updated/deleted by clients |

Rules: object path must match the row that authorizes it (`gallery_images.image_path`, `documents.file_path`); `profiles.profile_image_path`
and `contributions.receipt_path` must live under the owner's `<user_id>/` folder (database check constraints). Editing a public profile field resets
`public_profile_approved`. Uploading a photo does not make it public; approval does.
