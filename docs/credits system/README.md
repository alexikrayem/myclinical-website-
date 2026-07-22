# Credit System Documentation

This folder contains the complete technical, logical, and architectural documentation for the MyClinical End-to-End Credit System.

## Documentation Index

1. **[System Architecture](file:///Users/iskandermac/Downloads/project%206/documentation/credits%20system/architecture.md)**
   - High-level design overview
   - Structural design diagrams (Mermaid) explaining the credit ecosystem
   - Separation of concerns between databases, backend services, and client devices

2. **[Database Schema & RPC Storage Logic](file:///Users/iskandermac/Downloads/project%206/documentation/credits%20system/database-schema.md)**
   - Comprehensive tables structure (`user_credits`, `credit_transactions`, `license_codes`, `credit_types`, `credit_type_courses`, `user_typed_credits`)
   - Data types, primary keys, foreign keys, constraints, and index optimizations
   - Exact Pl/pgSQL RPC definitions (`redeem_license_code_v3`, `consume_video_minutes`, `consume_article_credit`, `consume_research_credit`, `purchase_course_access`)

3. **[API Services & Routing Layer](file:///Users/iskandermac/Downloads/project%206/documentation/credits%20system/api-services.md)**
   - API endpoints breakdown for users and administration
   - Service layers (`creditsService.js`) logic
   - Input validation schemas (Zod/validation middlewares) & Security rate-limiting policies (`redeemLimiter`, `consumeLimiter`)

4. **[Client Integration & Frontend Components](file:///Users/iskandermac/Downloads/project%206/documentation/credits%20system/frontend-integration.md)**
   - User Interface controllers (`CreditBalance.tsx` and `CreditRedeemModal.tsx` details)
   - React authentication state context integrations (`AuthContext.tsx`)
   - End-to-end user journeys (opening articles/researches, buying courses, consumption loops)

5. **[Concurrency safety & Security Hardening](file:///Users/iskandermac/Downloads/project%206/documentation/credits%20system/concurrency-security.md)**
   - Analysis of concurrency safety (Pessimistic locking via `FOR UPDATE` in SQL RPCs)
   - Time-of-Check to Time-of-Use (TOCTOU) bug resolutions
   - Idempotency guarantees (via idempotency keys) and ledger audit trails
