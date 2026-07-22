# Concurrency Safety & Security Hardening

The credit system handles core account assets. To prevent attacks such as double spending, billing exploits, and race conditions, the architecture implements database-level locking and validation policies.

---

## 1. Concurrency Controls (Anti-Double Spend)

### A. The TOCTOU Race Condition Vulnerability
A common vulnerability in transactional web apps is **TIME-OF-CHECK TO TIME-OF-USE (TOCTOU)**. 
- In naive implementations, checking user access and deducting credits are separated by asynchronous IO gaps:
  1. Server checks double-read: *Does user have access? No.*
  2. Server is loaded; it schedules database inserts.
  3. Meanwhile, user generates a parallel request. Second call checks: *Does user have access? No (first write hasn't finished).*
  4. Both threads proceed to deduct credits and grant access, resulting in a **double-deduction** (or granting access twice for a single payment).

```
[Request A] Check Access (None) ──────> (delay) ────────> Deduct 1 credit -> Insert access
[Request B] Check Access (None) ─────────────> Deduct 1 credit -> Insert access (Double Charge)
```

### B. Pessimistic Row Locking Cure (`FOR UPDATE`)
To address this concurrency issue, the database RPCs enforce **pessimistic row-level locking** utilizing the PostgreSQL `FOR UPDATE` clause:

```sql
SELECT article_credits, balance
INTO v_current_credits, v_current_balance
FROM user_credits
WHERE custom_user_id = p_user_id
FOR UPDATE;
```

#### How it works:
1. When **Request A** invokes the transaction, it locks the `user_credits` row for that specific client profile.
2. If **Request B** arrives concurrently, its transaction is suspended at the `FOR UPDATE` read operation. 
3. **Request A** completes its checks, deducts the credit, inserts the `article_access` log, and commits the transaction (releasing the row lock).
4. **Request B** is unblocked. It reads the updated state, detects that access already exists via the newly inserted log, and exits immediately with success:
   ```sql
   IF EXISTS (
     SELECT 1 FROM article_access
     WHERE user_id = p_user_id AND article_id = p_article_id
   ) THEN
     RETURN jsonb_build_object('success', true, 'message', 'لديك صلاحية الوصول بالفعل');
   END IF;
   ```
5. No credit double deduction occurs. The system behaves consistently under highly concurrent requests.

---

## 2. Idempotency Guarantees (`purchase_course_access`)

Purchasing a course involves high-value user credits. If a network drops or a user double-clicks, the request must not double-charge. This is resolved via **Idempotency Keys**:

```sql
IF p_idempotency_key IS NOT NULL THEN
  SELECT EXISTS(
    SELECT 1 FROM credit_transactions
    WHERE custom_user_id = p_user_id
      AND related_entity_type = 'course_access'
      AND related_entity_id = p_course_id
      AND metadata->>'idempotency_key' = p_idempotency_key
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object('success', true, 'message', 'تمت معالجة الطلب مسبقاً');
  END IF;
END IF;
```

- When the application requests a purchase, a unique key (UUID) is sent.
- The RPC checks if a transaction with the same user ID, target course, and idempotency key has already committed. If found, it skips charging and simply returns success.

---

## 3. Transactional Consistency & Ledger Integrity

1. **Atomic Code Redemptions**:
   - The license code row is locked using `FOR UPDATE` at step one.
   - This ensures multiple parallel nodes cannot redeem the same code simultaneously.
2. **`total_earned` Mathematical Realignment**:
   - Historically, `total_earned` only tracked values recorded in `credit_amount` which did not account for video-only or research-only packages (since their `credit_amount` was set to 0 and their values lived inside `video_minutes` or `research_count`).
   - The system was patched to compile the exact **deltas** of all categories. By measuring the difference between the before-state and after-state of each column, the delta aggregate is safely accumulated inside `total_earned`:
     ```plpgsql
     v_total_earned_delta :=
       (v_new_balance          - v_current_balance)          +
       (v_new_video_minutes    - v_current_video_minutes)    +
       (v_new_article_credits  - v_current_article_credits)  +
       (v_new_research_credits - v_current_research_credits);
     ```
3. **Transaction Logging Integrity**:
   - To prevent ledger tampering, every credit adjustment trigger performs an inline write into `credit_transactions` within the **same atomic database transaction**. If the parent adjustment fails, the audit log rollback prevents discrepancies.
