// ============================
// Idempotent seed. Pulled out of the original database.js so seeding is its own
// concern, can run independently, and never duplicates rows on restart.
// ============================

const bcrypt = require('bcryptjs');
const db     = require('./index');
const log    = require('../utils/logger');

const PAINTERS = [
  { name: 'Kwame Asante',    phone: '0244100001', email: 'kwame@paintgh.com',  city: 'Accra',      area: 'East Legon / Airport Residential',     bio: 'Professional painter with 8 years experience. Interior, exterior and commercial.',         exp: 8,  rate: 350, services: ['Interior','Exterior','Commercial'],                 materials: 1, color: '#e67e22', rating: 4.9, reviews: 48 },
  { name: 'Abena Boateng',   phone: '0244100002', email: 'abena@paintgh.com',  city: 'Kumasi',     area: 'Nhyiaeso / Adum',                      bio: 'Specialist in decorative painting, murals and textured walls.',                            exp: 5,  rate: 280, services: ['Interior','Decorative'],                            materials: 0, color: '#16a085', rating: 4.7, reviews: 31 },
  { name: 'Ebo Mensah',      phone: '0244100003', email: 'ebo@paintgh.com',    city: 'Takoradi',   area: 'Effia / Sekondi',                      bio: 'Senior commercial painter with 12 years experience. Waterproofing expert.',                exp: 12, rate: 420, services: ['Interior','Exterior','Commercial','Waterproofing'], materials: 1, color: '#8e44ad', rating: 5.0, reviews: 62 },
  { name: 'Akosua Frimpong', phone: '0244100004', email: 'akosua@paintgh.com', city: 'Accra',      area: 'Tema / Ashaiman',                      bio: 'Specializing in interior repainting and restoration of older properties.',                  exp: 4,  rate: 250, services: ['Interior','Repaint'],                                materials: 0, color: '#c0392b', rating: 4.6, reviews: 19 },
  { name: 'Yaw Darko',       phone: '0244100005', email: 'yaw@paintgh.com',    city: 'Cape Coast', area: 'Cape Coast / Elmina',                  bio: 'Expert in coastal climate exterior painting. Heat and salt resistant coatings.',           exp: 6,  rate: 300, services: ['Interior','Exterior','Waterproofing'],               materials: 1, color: '#2980b9', rating: 4.8, reviews: 27 },
  { name: 'Kofi Amoah',      phone: '0244100006', email: 'kofi@paintgh.com',   city: 'Kumasi',     area: 'Bantama / Suame',                      bio: 'Young energetic painter. Fast turnarounds and competitive rates.',                         exp: 3,  rate: 220, services: ['Interior','Exterior'],                               materials: 0, color: '#27ae60', rating: 4.5, reviews: 15 },
  { name: 'Efua Asiedu',     phone: '0244100007', email: 'efua@paintgh.com',   city: 'Tamale',     area: 'Tamale / Tolon',                       bio: 'Leading painter in Northern Ghana. Heat-resistant exterior coatings for Savannah climate.', exp: 5,  rate: 260, services: ['Interior','Exterior','Decorative'],                  materials: 0, color: '#d35400', rating: 4.7, reviews: 22 },
  { name: 'Nana Osei',       phone: '0244100008', email: 'nana@paintgh.com',   city: 'Tema',       area: 'Tema Community 1-12',                  bio: 'Senior contractor. Factories, warehouses, estates. Full team for large projects.',         exp: 9,  rate: 380, services: ['Interior','Exterior','Commercial','Waterproofing'], materials: 1, color: '#1abc9c', rating: 4.9, reviews: 35 },
];
const NON_PAINTERS = [
  { name: 'Ama Owusu',      phone: '0244200001', email: 'ama@example.com',         role: 'customer' },
  // The bootstrap admin is granted super_admin so a fresh install can
  // dispatch jobs and approve QA out of the box without needing a second
  // admin to grant them a sub-role.
  { name: 'Akosua Boateng', phone: '0244000000', email: 'akosua@paintmasters.gh',  role: 'admin', sub_role: 'super_admin' },
];

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) { log.debug('Seed: users already present, skipping.'); return { seeded: false }; }

  const hash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare(`
    INSERT INTO users (name, phone, email, password, role) VALUES (@name, @phone, @email, @password, @role)
  `);
  const insertProfile = db.prepare(`
    INSERT INTO painter_profiles
      (user_id, city, area, bio, experience_years, rate_per_day, services, materials_included, verified, avatar_color, avg_rating, review_count)
    VALUES
      (@user_id, @city, @area, @bio, @exp, @rate, @services, @materials, 1, @color, @rating, @reviews)
  `);

  db.transaction(() => {
    for (const p of PAINTERS) {
      const r = insertUser.run({ name: p.name, phone: p.phone, email: p.email, password: hash, role: 'painter' });
      insertProfile.run({
        user_id: r.lastInsertRowid,
        city: p.city, area: p.area, bio: p.bio, exp: p.exp, rate: p.rate,
        services: JSON.stringify(p.services), materials: p.materials,
        color: p.color, rating: p.rating, reviews: p.reviews,
      });
    }
    const setSubRole = db.prepare('UPDATE users SET sub_role = ? WHERE id = ?');
    for (const u of NON_PAINTERS) {
      const r = insertUser.run({ name: u.name, phone: u.phone, email: u.email, password: hash, role: u.role });
      if (u.sub_role) setSubRole.run(u.sub_role, r.lastInsertRowid);
    }

    // Sample booking + review (as before — keeps the demo realistic)
    db.prepare(`
      INSERT INTO bookings (id, customer_id, painter_id, service, address, job_date, duration_days, subtotal, platform_fee, total, payment_method, payment_status, status)
      VALUES ('BK-DEMO0001', 9, 1, 'Interior', 'Madina, Accra', '2026-04-25', 3, 1050, 105, 1155, 'momo', 'paid', 'confirmed')
    `).run();
    db.prepare(`
      INSERT INTO reviews (booking_id, painter_id, customer_id, rating, comment)
      VALUES ('BK-DEMO0001', 1, 9, 5, 'Kwame did an outstanding job. Professional and punctual!')
    `).run();
    db.prepare(`
      UPDATE painter_profiles
         SET avg_rating   = (SELECT AVG(rating)   FROM reviews WHERE painter_id = 1),
             review_count = (SELECT COUNT(*)      FROM reviews WHERE painter_id = 1),
             updated_at   = datetime('now')
       WHERE id = 1
    `).run();
  })();

  log.info('Seeded demo data.');
  return { seeded: true, painters: PAINTERS.length, others: NON_PAINTERS.length };
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(seed());
}

module.exports = seed;
