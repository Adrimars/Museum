# UC-MEDIA — Media Management

---

## Upload

### UC-MU01: Upload User Avatar
**Actor:** Authenticated User  
**Precondition:** User is logged in.  
**Main Flow:**
1. User selects an image for their avatar.
2. System validates file size (≤2 MB) and format (JPEG, PNG, WebP).
3. A pre-signed upload URL is issued; client uploads directly to storage.
4. Image optimization pipeline processes the upload.
**Exceptions:**
- File exceeds size limit → upload rejected.
- Unsupported format → upload rejected.

---

### UC-MU02: Upload Artifact Image
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to the museum.  
**Main Flow:**
1. Actor selects an image for an artifact (≤15 MB).
2. System validates size and format.
3. Pre-signed URL is issued; client uploads directly.
4. Optimization pipeline generates thumbnail, medium, and full-size variants.
**Exceptions:**
- File exceeds 15 MB → upload rejected.
- Unsupported format → upload rejected.

---

### UC-MU03: Upload Audio Guide
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to the museum.  
**Main Flow:**
1. Actor uploads an audio file for an artifact (≤50 MB, MP3/AAC/OGG).
2. System validates size and format.
3. Pre-signed URL is issued; client uploads directly.
**Exceptions:**
- File exceeds 50 MB → upload rejected.
- Unsupported format → upload rejected.

---

### UC-MU04: Upload Rejected — File Too Large
**Actor:** Any uploader  
**Precondition:** User attempts to upload a file exceeding the size limit.  
**Main Flow:**
1. User requests a pre-signed URL with a declared file size.
2. System detects the size exceeds the allowed limit for the asset type.
3. Upload is rejected before any file transfer occurs.
**Exceptions:**
- None.

---

### UC-MU05: Upload Rejected — Invalid Format
**Actor:** Any uploader  
**Precondition:** User attempts to upload an unsupported file format.  
**Main Flow:**
1. User requests a pre-signed URL with a declared MIME type.
2. System detects the format is not in the accepted list.
3. Upload is rejected.
**Exceptions:**
- None.

---

## Edge Cases

### UC-ME01: Delete Media Asset
**Actor:** Museum Admin  
**Precondition:** Media asset exists in S3 for an artifact within actor's museum.  
**Main Flow:**
1. Museum admin requests deletion of a media asset.
2. System deletes the asset from S3/R2.
3. CDN cache for the asset is invalidated.
4. The corresponding URL is removed from the artifact's `media_urls` JSONB.
**Exceptions:**
- Content editor attempts media deletion → denied (insufficient role).

---

### UC-ME02: Pre-Signed URL Expires Before Upload
**Actor:** Any uploader  
**Precondition:** User obtained a pre-signed URL but did not upload within 5 minutes.  
**Main Flow:**
1. User receives a pre-signed upload URL.
2. User does not complete the upload within the 5-minute window.
3. S3 rejects the upload request (expired signature).
4. User must request a new pre-signed URL and retry.
**Exceptions:**
- None.

---

### UC-ME03: Image Optimization Pipeline Failure
**Actor:** System  
**Precondition:** File was uploaded to S3 successfully; Bull job for optimization is triggered.  
**Main Flow:**
1. Optimization job starts (WebP conversion, variant generation).
2. Job fails (e.g., corrupt image, out of memory, unsupported edge-case format).
3. Job is retried (max 3 retries with exponential backoff).
4. If all retries fail, the original uploaded file is retained in S3.
5. Artifact's `media_urls` contains only the original file URL (no optimized variants).
6. Failure is logged for admin review.
**Exceptions:**
- None.

---

### UC-ME04: Cross-Museum Media Upload Denied
**Actor:** Content Editor  
**Precondition:** Actor is scoped to Museum A.  
**Main Flow:**
1. Actor requests a pre-signed URL with a context referencing a Museum B artifact.
2. System detects the museum scope mismatch via tenant isolation.
3. Pre-signed URL request is denied.
**Exceptions:**
- None.

---

### UC-ME05: Upload Reward Asset (Badge/Certificate Image)
**Actor:** Content Editor / Museum Admin  
**Precondition:** Actor is scoped to the museum and creating/updating a reward definition.  
**Main Flow:**
1. Actor requests a pre-signed URL with context `reward_asset`.
2. System validates file size (≤15 MB) and format (JPEG, PNG, WebP).
3. Pre-signed URL is issued; client uploads directly.
4. Optimization pipeline generates variants for the reward asset.
**Exceptions:**
- File exceeds size limit → upload rejected.
- Unsupported format → upload rejected.
