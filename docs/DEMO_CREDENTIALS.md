# Demo credentials — every account that can sign in

Demo-mode only. When the platform is flipped to `production` (see `DEPLOYMENT.md`),
this list stops working — only the real backend can sign anyone in.

All demo accounts use **password123**. The first sign-in flow does NOT force a
password change in demo mode (that's an admin-invited-account behaviour); change
the seed in `assets/shared.js` if you want different demo passwords.

---

## Admin

| Phone        | Password    | Name             | Role  | Region |
|--------------|-------------|------------------|-------|--------|
| 0244000000   | password123 | Akosua Boateng   | admin | Accra  |

## Customer

| Phone        | Password    | Name        | Role     | Region |
|--------------|-------------|-------------|----------|--------|
| 0244200001   | password123 | Ama Owusu   | customer | Accra  |

## Paint Masters (12)

Every painter in the admin roster has a sign-in. Phones follow `0243 000 00N`.

| Phone        | Password    | Name              | Region     | Specialties               |
|--------------|-------------|-------------------|------------|---------------------------|
| 0243000001   | password123 | Kofi Asante       | Accra      | Interior · Decorative     |
| 0243000002   | password123 | Ama Mensah        | Accra      | Decorative · Interior     |
| 0243000003   | password123 | Yaw Owusu         | Tema       | Commercial · Epoxy        |
| 0243000004   | password123 | Abena Boateng     | Accra      | Interior                  |
| 0243000005   | password123 | Kwame Dankwa      | Kumasi     | Roof · Commercial         |
| 0243000006   | password123 | Efua Adjei        | Accra      | Decorative                |
| 0243000007   | password123 | Kojo Ntim         | Accra      | Epoxy · Commercial        |
| 0243000008   | password123 | Akosua Sarpong    | Cape Coast | Interior · Roof           |
| 0243000009   | password123 | Kwabena Botwe     | Tema       | Roof                      |
| 0243000010   | password123 | Adwoa Darko       | Accra      | Interior · Decorative     |
| 0243000011   | password123 | Yaa Boadu         | Accra      | Commercial                |
| 0243000012   | password123 | Kwesi Ofori       | Takoradi   | Epoxy · Roof              |

---

## Notes for the demo

- After signing in, **admin** lands on `/admin/`, **customer** on `/my.html`, and **Paint Masters** on `/painter.html`.
- Each Paint Master sees only their own jobs and notifications. Switching between Master accounts demonstrates that the platform isolates one Master from another.
- Phones can be typed with or without spaces — the login form strips whitespace before matching.
- To wipe a stuck session and try a different account: open the bell dropdown (admin) or the account dropdown (customer/painter) and choose Sign out.
