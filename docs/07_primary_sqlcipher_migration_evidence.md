# Primary SQLCipher Migration Evidence

This document registers the safety backup details and pre-migration verification metrics for the primary database transition.

---

## 1. Safety Backup Configuration

*   **Backup Timestamp:** `20260802-111228`
*   **Backup Root Directory:** `C:\Users\DELL7480\Desktop\Practice Project 26\migration-safety-backup-20260802-111228`
*   **Original Database File Size:** `20,480 bytes`
*   **Original Shop Table Row Count:** `1`

---

## 2. Pre-Migration Checksums Manifest

| File Path | SHA-256 Checksum |
| :--- | :--- |
| `package.json` | `a69f2c6ed61d835487c02bc9e9e446255868dbbe694c358eae2859260e263703` |
| `package-lock.json` | `2faef45f2934961e99dd9152433e607e3ff94a5088d2ba777918d5175feaace7` |
| `prisma/schema.prisma` | `5beb65b7297b766454a0424c95386180cd6531af368ad0aebca82a0d07763a1c` |
| `prisma/dev.db` | `18699d92859d40d85c6c5b07bcc6f9d6b4e7009872fbb0b16d4bdc0479fa0e6d` |
| `prisma/dev-backup.db.bak` | `b5012374308427ab9bbfac582923f72e02a46ddf967d07fef9469acfd376fffe` |
| `electron/database/prisma.ts` | `1c380895364ee10a4396cfef1736367853530ef4804213ee98347b6fcc07085e` |
| `electron/services/shop.service.ts` | `0543cd67956a76a29c514d03c84d0b776a55e6010ea99dd3614cb5d77fc2652c` |
| `electron/ipc/shop.ipc.ts` | `b9e2ce0781b7e12714a5f712e1a817650c605d3eb2a2b69395971133b8da5e99` |
| `prisma/migrations/20260727094027_init/migration.sql` | `f307dfe2083aee7506fa0beee13a6171475781b76584b166f50105721400b58c` |

---

## 3. Pre-Migration Shop Verification Values

*   **id:** `3e3bab1e-e0a8-4a29-ab16-95341adc00e4`
*   **name:** `Abhijeet Store`
*   **phone:** `7709400101`
*   **address:** `null` (empty)
*   **gstNumber:** `null` (empty)
*   **createdAt:** `1785475728047` (Epoch timestamp)
*   **updatedAt:** `1785475728047` (Epoch timestamp)
