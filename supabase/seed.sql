-- KidSkill Connect — demo seed.
--
-- 16 trainers across real Bangalore neighbourhoods with real coordinates, spanning
-- music, dance, sports, chess and arts, so distance sorting and category breadth are
-- both visibly correct in the demo rather than merely implemented.
--
-- Two things are done the long way round on purpose:
--   * enrollments are funded by calling fund_enrollment(), not by hand-writing ledger
--     rows, so the seed exercises the same money path the app does;
--   * attended sessions are created by UPDATEing status, so the release trigger fires
--     and every rupee of seeded history is a real trigger-authored ledger entry.
-- If either invariant regresses, `supabase db reset` fails loudly. That is the point.

-- ---------------------------------------------------------------- auth users

-- Local-only. Phone auth is real Supabase phone auth; the OTP is pinned to 123456 in
-- config.toml under [auth.sms.test_otp], so no SMS provider is needed to sign in.
create or replace function pg_temp.mk_user(p_id uuid, p_phone text)
returns uuid language plpgsql as $fn$
declare
  -- GoTrue normalises phone numbers to E.164 *without* the leading plus, and looks
  -- users up by that form. Seeding '+919876500001' means a sign-in for that number
  -- matches nothing and silently creates a second, profile-less user instead.
  v_phone text := ltrim(p_phone, '+');
begin
  insert into auth.users (
    instance_id, id, aud, role, phone, phone_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    v_phone, now(),
    jsonb_build_object('provider', 'phone', 'providers', array['phone']), '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (extensions.gen_random_uuid(), p_id, v_phone,
          jsonb_build_object('sub', p_id::text, 'phone', v_phone), 'phone', now(), now(), now());

  return p_id;
end $fn$;

-- Deterministic ids so every screen can be deep-linked during a dry run.
select pg_temp.mk_user('11111111-1111-4111-8111-000000000001', '+919876500001'); -- parent  Anitha
select pg_temp.mk_user('11111111-1111-4111-8111-000000000002', '+919876500002'); -- parent  Vikram
select pg_temp.mk_user('11111111-1111-4111-8111-000000000003', '+919876500003'); -- parent  Farah
select pg_temp.mk_user('11111111-1111-4111-8111-000000000004', '+919876500004'); -- parent  Rohan
select pg_temp.mk_user('22222222-2222-4222-8222-000000000001', '+919876510001'); -- trainer Lakshmi
select pg_temp.mk_user('22222222-2222-4222-8222-000000000002', '+919876510002'); -- trainer Deepa
select pg_temp.mk_user('22222222-2222-4222-8222-000000000003', '+919876510003'); -- trainer Ravi
select pg_temp.mk_user('22222222-2222-4222-8222-000000000004', '+919876510004'); -- trainer Anand
select pg_temp.mk_user('22222222-2222-4222-8222-000000000005', '+919876510005'); -- trainer Priya
select pg_temp.mk_user('22222222-2222-4222-8222-000000000006', '+919876510006'); -- trainer Suresh
select pg_temp.mk_user('22222222-2222-4222-8222-000000000007', '+919876510007'); -- trainer Nisha
select pg_temp.mk_user('22222222-2222-4222-8222-000000000008', '+919876510008'); -- trainer Manjunath
select pg_temp.mk_user('22222222-2222-4222-8222-000000000009', '+919876510009'); -- trainer Fatima
select pg_temp.mk_user('22222222-2222-4222-8222-000000000010', '+919876510010'); -- trainer Girish
select pg_temp.mk_user('22222222-2222-4222-8222-000000000011', '+919876510011'); -- trainer Meenakshi
select pg_temp.mk_user('22222222-2222-4222-8222-000000000012', '+919876510012'); -- trainer Arjun
select pg_temp.mk_user('22222222-2222-4222-8222-000000000013', '+919876510013'); -- trainer Kavya
select pg_temp.mk_user('22222222-2222-4222-8222-000000000014', '+919876510014'); -- trainer Rahul
select pg_temp.mk_user('22222222-2222-4222-8222-000000000015', '+919876510015'); -- trainer Vikram Nair
select pg_temp.mk_user('22222222-2222-4222-8222-000000000016', '+919876510016'); -- trainer Ayesha
select pg_temp.mk_user('33333333-3333-4333-8333-000000000001', '+919876590001'); -- admin

-- ---------------------------------------------------------------- profiles

-- trg_bootstrap_accounts opens the wallet / escrow / earnings accounts off these rows.
insert into public.profiles (id, role, full_name, phone, avatar_url, location, area_label) values
  ('11111111-1111-4111-8111-000000000001', 'parent', 'Anitha Rao',    '+919876500001', null,
   extensions.ST_SetSRID(extensions.ST_MakePoint(77.6408, 13.0159), 4326)::extensions.geography, 'Kammanahalli'),
  ('11111111-1111-4111-8111-000000000002', 'parent', 'Vikram Shetty', '+919876500002', null,
   extensions.ST_SetSRID(extensions.ST_MakePoint(77.6408, 12.9784), 4326)::extensions.geography, 'Indiranagar'),
  -- Deliberately no enquiries, enrollments or sessions for these two — a clean parent
  -- account to click through search -> enquiry -> accept -> pay yourself, rather than
  -- one that already has the demo's history baked in.
  ('11111111-1111-4111-8111-000000000003', 'parent', 'Farah Qureshi', '+919876500003', null,
   extensions.ST_SetSRID(extensions.ST_MakePoint(77.6650, 12.9850), 4326)::extensions.geography, 'CV Raman Nagar'),
  ('11111111-1111-4111-8111-000000000004', 'parent', 'Rohan Iyer',    '+919876500004', null,
   extensions.ST_SetSRID(extensions.ST_MakePoint(77.6245, 12.9352), 4326)::extensions.geography, 'Koramangala'),
  ('33333333-3333-4333-8333-000000000001', 'admin',  'Meera Kulkarni','+919876590001', null, null, 'HQ');

insert into public.profiles (id, role, full_name, phone, area_label) values
  ('22222222-2222-4222-8222-000000000001', 'trainer', 'Lakshmi Narayanan', '+919876510001', 'Kalyan Nagar'),
  ('22222222-2222-4222-8222-000000000002', 'trainer', 'Deepa Iyer',        '+919876510002', 'Banaswadi'),
  ('22222222-2222-4222-8222-000000000003', 'trainer', 'Ravi Shankar Bhat', '+919876510003', 'Malleshwaram'),
  ('22222222-2222-4222-8222-000000000004', 'trainer', 'Anand Kumar',       '+919876510004', 'Lingarajapuram'),
  ('22222222-2222-4222-8222-000000000005', 'trainer', 'Priya Menon',       '+919876510005', 'HRBR Layout'),
  ('22222222-2222-4222-8222-000000000006', 'trainer', 'Suresh Gowda',      '+919876510006', 'CV Raman Nagar'),
  ('22222222-2222-4222-8222-000000000007', 'trainer', 'Nisha Fernandes',   '+919876510007', 'Indiranagar'),
  ('22222222-2222-4222-8222-000000000008', 'trainer', 'Manjunath Reddy',   '+919876510008', 'Koramangala'),
  ('22222222-2222-4222-8222-000000000009', 'trainer', 'Fatima Zohra',      '+919876510009', 'Hennur'),
  ('22222222-2222-4222-8222-000000000010', 'trainer', 'Girish Patil',      '+919876510010', 'Whitefield'),
  ('22222222-2222-4222-8222-000000000011', 'trainer', 'Meenakshi Pillai',  '+919876510011', 'Jayanagar'),
  ('22222222-2222-4222-8222-000000000012', 'trainer', 'Arjun Varma',       '+919876510012', 'JP Nagar'),
  ('22222222-2222-4222-8222-000000000013', 'trainer', 'Kavya Subramaniam', '+919876510013', 'Basavanagudi'),
  ('22222222-2222-4222-8222-000000000014', 'trainer', 'Rahul Dsouza',      '+919876510014', 'Yelahanka'),
  ('22222222-2222-4222-8222-000000000015', 'trainer', 'Vikram Nair',       '+919876510015', 'Marathahalli'),
  ('22222222-2222-4222-8222-000000000016', 'trainer', 'Ayesha Khan',       '+919876510016', 'Sarjapur Road');

-- ---------------------------------------------------------------- children

insert into public.children (id, parent_id, name, dob, interests, notes) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001',
   'Aarav', date '2016-04-12', array['music','drawing'], 'Shy for the first ten minutes, then fine.'),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-000000000001',
   'Diya',  date '2019-09-03', array['swimming'], null),
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-000000000002',
   'Ishaan', date '2014-01-22', array['music','chess'], 'Left-handed.'),
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-000000000003',
   'Rehan', date '2017-06-18', array['football','cricket'], null),
  ('44444444-4444-4444-8444-000000000005', '11111111-1111-4111-8111-000000000004',
   'Myra', date '2019-02-09', array['dance','music'], null);

-- ---------------------------------------------------------------- trainer profiles

-- Coordinates are real. Distances from Anitha in Kammanahalli (13.0159, 77.6408) for the
-- original ten:
--   Priya 0.7km · Lakshmi 1.0km · Deepa 1.3km · Anand 1.9km · Fatima 2.2km
--   Nisha 4.2km · Suresh 4.3km · Manjunath 9.2km · Ravi 7.6km · Girish 13.5km
-- Manjunath's own service radius is 7km, so he correctly does *not* surface to her
-- even when she widens the slider — the radius is a two-way constraint. The six added
-- for music/dance/sports breadth (Meenakshi, Arjun, Kavya, Rahul, Vikram Nair, Ayesha)
-- sit further south and west, closer to Vikram Shetty in Indiranagar than to Anitha.
insert into public.trainer_profiles
  (user_id, headline, bio, years_experience, base_location, service_radius_km, id_verified) values
  ('22222222-2222-4222-8222-000000000001',
   'Carnatic vocal — 18 years, Vidwan-trained',
   'Learned under Vidwan R. K. Srikantan for eleven years. I teach varnams and kritis the slow way: swaram first, lyric second. Children start with Sarali Varisai and I do not rush it.',
   18, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6400, 13.0250), 4326)::extensions.geography, 8, true),
  ('22222222-2222-4222-8222-000000000002',
   'Carnatic vocal for beginners, patient with young starters',
   'I take children from six upwards. My focus is on shruti discipline before repertoire — a child who sings in tune at seven sings in tune at seventeen.',
   7, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6520, 13.0125), 4326)::extensions.geography, 6, true),
  ('22222222-2222-4222-8222-000000000003',
   'Carnatic vocal and theory, ex-faculty Bangalore Gayana Samaja',
   'Twenty-two years of teaching, six of them at Gayana Samaja. I take advanced students to their first kutcheri and prepare for grade exams.',
   22, extensions.ST_SetSRID(extensions.ST_MakePoint(77.5709, 13.0035), 4326)::extensions.geography, 12, true),
  ('22222222-2222-4222-8222-000000000004',
   'Western guitar — chords, rhythm and reading',
   'Session guitarist turned teacher. I start kids on rhythm before melody so they learn to keep time with other people, not just alone in a room.',
   9, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6260, 13.0070), 4326)::extensions.geography, 10, false),
  ('22222222-2222-4222-8222-000000000005',
   'Sketching and observational drawing for 6–14s',
   'I trained at Chitrakala Parishath. Children draw from life from week one — a plant, a shoe, a hand. Copying from photos comes much later, if at all.',
   11, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6350, 13.0180), 4326)::extensions.geography, 7, true),
  ('22222222-2222-4222-8222-000000000006',
   'Football — grassroots coaching, AIFF D licence',
   'Fifteen years with district youth sides. Small-sided games, lots of touches, very little standing in lines.',
   15, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6650, 12.9850), 4326)::extensions.geography, 10, true),
  ('22222222-2222-4222-8222-000000000007',
   'Swimming — learn-to-swim and stroke correction',
   'Former state-level swimmer. Water confidence first; strokes only once a child is genuinely comfortable putting their face in.',
   12, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6408, 12.9784), 4326)::extensions.geography, 5, true),
  ('22222222-2222-4222-8222-000000000008',
   'Chess — FIDE rated 2087, coaching since 2015',
   'I teach endgames before openings. It is less exciting for the first month and much better for the next ten years.',
   10, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6245, 12.9352), 4326)::extensions.geography, 7, true),
  ('22222222-2222-4222-8222-000000000009',
   'Western guitar and ukulele, songs from lesson one',
   'Children stay when they can play something their friends recognise. Technique comes in through the songs, not before them.',
   6, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6350, 13.0350), 4326)::extensions.geography, 8, false),
  ('22222222-2222-4222-8222-000000000010',
   'Football and general athletic conditioning',
   'I coach at two Whitefield schools. Strong on fitness and injury prevention for growing kids.',
   8, extensions.ST_SetSRID(extensions.ST_MakePoint(77.7500, 12.9698), 4326)::extensions.geography, 12, false),
  ('22222222-2222-4222-8222-000000000011',
   'Hindustani vocal — khayal, 14 years teaching',
   'Trained in the Gwalior gharana. Children start with sur and laya on the harmonium before a single bandish, so the ear is trained before the voice is asked to do anything.',
   14, extensions.ST_SetSRID(extensions.ST_MakePoint(77.5946, 12.9250), 4326)::extensions.geography, 8, true),
  ('22222222-2222-4222-8222-000000000012',
   'Keyboard and piano — Trinity syllabus, exam prep available',
   'I teach reading notation from lesson one, not just ear-copying. Most children are playing a two-hand piece within two months and a Trinity Grade 1 candidate within a year, if that is the goal.',
   10, extensions.ST_SetSRID(extensions.ST_MakePoint(77.5921, 12.9077), 4326)::extensions.geography, 9, true),
  ('22222222-2222-4222-8222-000000000013',
   'Bharatanatyam — arangetram-trained, 16 years',
   'Trained under a Chennai guru for twelve years before my own arangetram. Adavus are drilled for a full year before any item is introduced — the discipline is the whole first stage, not a formality before the fun part.',
   16, extensions.ST_SetSRID(extensions.ST_MakePoint(77.5738, 12.9422), 4326)::extensions.geography, 10, true),
  ('22222222-2222-4222-8222-000000000014',
   'Hip-hop dance — choreography for 7–16s',
   'Ex-crew dancer, now teaching. We build a routine every four weeks so there is always something to show at home, alongside the technique drilling that does not look as exciting on a phone camera.',
   9, extensions.ST_SetSRID(extensions.ST_MakePoint(77.5960, 13.1005), 4326)::extensions.geography, 8, false),
  ('22222222-2222-4222-8222-000000000015',
   'Cricket — batting and fielding, BCCI level 1 coach',
   'Focus on batting technique and fielding fundamentals for age-group cricket. Nets first, matches later — a child who can only slog in the nets struggles the moment a bowler varies pace.',
   12, extensions.ST_SetSRID(extensions.ST_MakePoint(77.7011, 12.9569), 4326)::extensions.geography, 12, true),
  ('22222222-2222-4222-8222-000000000016',
   'Badminton — footwork and singles play, ex-state level',
   'Played state-level singles before coaching. Footwork drills before racquet work for the first month — most children hit fine and move badly, and that is the harder thing to fix later.',
   8, extensions.ST_SetSRID(extensions.ST_MakePoint(77.6874, 12.9000), 4326)::extensions.geography, 10, true);

-- ---------------------------------------------------------------- how they teach

-- Chess and music work on a screen; you cannot coach swimming or football through one.
update public.trainer_profiles set teaches_online = true where user_id in (
  '22222222-2222-4222-8222-000000000001',  -- Lakshmi, Carnatic vocal
  '22222222-2222-4222-8222-000000000003',  -- Ravi, Carnatic vocal + theory
  '22222222-2222-4222-8222-000000000008',  -- Manjunath, chess
  '22222222-2222-4222-8222-000000000009',  -- Fatima, guitar
  '22222222-2222-4222-8222-000000000011',  -- Meenakshi, Hindustani vocal
  '22222222-2222-4222-8222-000000000012'   -- Arjun, keyboard & piano
);

-- Ravi is far from most parents but teaches online, which is exactly the case the
-- radius rule should stop hiding.
update public.trainer_profiles set teaches_in_person = false
where user_id = '22222222-2222-4222-8222-000000000003';

-- ---------------------------------------------------------------- identity

-- Only the last four digits, as everywhere else — see migration 0008 for why.
--
-- The twelve verified trainers have been through review. Anand has submitted and is
-- waiting, so the admin can verify him and then approve his category in one visit.
-- Girish, Fatima and Rahul have submitted nothing, so Girish's pending application
-- demonstrates the gate: an admin trying to approve him is refused until identity exists.
update public.trainer_profiles tp set
  id_type         = 'aadhaar',
  id_last4        = v.last4,
  id_name         = p.full_name,
  id_document_url = '/identity/' || split_part(lower(p.full_name), ' ', 1) || '-aadhaar.jpg',
  id_submitted_at = now() - interval '21 days',
  id_verified_at  = now() - interval '20 days',
  id_verified_by  = '33333333-3333-4333-8333-000000000001',
  id_verified     = true
from (values
  ('22222222-2222-4222-8222-000000000001'::uuid, '4417'),
  ('22222222-2222-4222-8222-000000000002'::uuid, '9032'),
  ('22222222-2222-4222-8222-000000000003'::uuid, '1185'),
  ('22222222-2222-4222-8222-000000000005'::uuid, '7724'),
  ('22222222-2222-4222-8222-000000000006'::uuid, '3390'),
  ('22222222-2222-4222-8222-000000000007'::uuid, '6058'),
  ('22222222-2222-4222-8222-000000000008'::uuid, '2261'),
  ('22222222-2222-4222-8222-000000000011'::uuid, '8845'),
  ('22222222-2222-4222-8222-000000000012'::uuid, '1573'),
  ('22222222-2222-4222-8222-000000000013'::uuid, '6602'),
  ('22222222-2222-4222-8222-000000000015'::uuid, '4419'),
  ('22222222-2222-4222-8222-000000000016'::uuid, '7738')
) as v(trainer, last4)
join public.profiles p on p.id = v.trainer
where tp.user_id = v.trainer;

-- Submitted, not yet looked at. This is the one the admin acts on in the demo.
update public.trainer_profiles set
  id_type         = 'aadhaar',
  id_last4        = '5516',
  id_name         = 'Anand Kumar',
  id_document_url = '/identity/anand-aadhaar.jpg',
  id_submitted_at = now() - interval '2 days',
  id_verified     = false
where user_id = '22222222-2222-4222-8222-000000000004';

-- Fatima teaches guitar and is approved for it, but never submitted a document. She is
-- the standing reminder that `id_verified` and "approved to teach" are two different
-- things, and that the seed predates the gate.
update public.trainer_profiles set id_verified = false
where user_id = '22222222-2222-4222-8222-000000000009';

-- ---------------------------------------------------------------- category applications

-- Eight approved, two pending. The two pending are what the admin approvals queue acts
-- on during the demo, so they have real credential notes to read.
insert into public.trainer_categories
  (id, trainer_id, category_id, rate_per_class, credential_url, credential_note, status, reviewed_by, reviewed_at)
select
  v.id, v.trainer, c.id, v.rate, v.url, v.note, v.st::verification_status,
  case when v.st = 'approved' then '33333333-3333-4333-8333-000000000001'::uuid end,
  case when v.st = 'approved' then now() - interval '20 days' end
from (values
  ('55555555-5555-4555-8555-000000000001'::uuid, '22222222-2222-4222-8222-000000000001'::uuid, 'carnatic-vocal', 800.00,
   '/credentials/lakshmi-vidwan.pdf',
   'Certificate of completion, Vidwan course, Karnataka Secondary Education Board, 2006. Letter of study from Vidwan R. K. Srikantan.', 'approved'),
  ('55555555-5555-4555-8555-000000000002'::uuid, '22222222-2222-4222-8222-000000000002'::uuid, 'carnatic-vocal', 650.00,
   '/credentials/deepa-senior-grade.pdf',
   'Senior Grade certificate, Karnataka Secondary Education Examination Board, 2017.', 'approved'),
  ('55555555-5555-4555-8555-000000000003'::uuid, '22222222-2222-4222-8222-000000000003'::uuid, 'carnatic-vocal', 950.00,
   '/credentials/ravi-gayana-samaja.pdf',
   'Employment letter, Bangalore Gayana Samaja, faculty 2011–2017. Vidwan certificate 2001.', 'approved'),
  ('55555555-5555-4555-8555-000000000004'::uuid, '22222222-2222-4222-8222-000000000004'::uuid, 'western-guitar', 700.00,
   '/credentials/anand-trinity-8.pdf',
   'Trinity College London Grade 8 Guitar, distinction, 2013.', 'approved'),
  ('55555555-5555-4555-8555-000000000005'::uuid, '22222222-2222-4222-8222-000000000005'::uuid, 'sketching', 500.00,
   '/credentials/priya-chitrakala.pdf',
   'BFA, Chitrakala Parishath, 2012. Two group shows, Venkatappa Art Gallery.', 'approved'),
  ('55555555-5555-4555-8555-000000000006'::uuid, '22222222-2222-4222-8222-000000000006'::uuid, 'football', 600.00,
   '/credentials/suresh-aiff-d.pdf',
   'AIFF D Licence, 2019. District youth coach, Bangalore Urban, 2010–present.', 'approved'),
  ('55555555-5555-4555-8555-000000000007'::uuid, '22222222-2222-4222-8222-000000000007'::uuid, 'swimming', 900.00,
   '/credentials/nisha-state-swim.pdf',
   'Karnataka state championship record, 2008. Swim India learn-to-swim instructor certification.', 'approved'),
  ('55555555-5555-4555-8555-000000000008'::uuid, '22222222-2222-4222-8222-000000000008'::uuid, 'chess', 550.00,
   '/credentials/manjunath-fide.pdf',
   'FIDE ID 25089114, standard rating 2087. AICF certified coach.', 'approved'),
  ('55555555-5555-4555-8555-000000000009'::uuid, '22222222-2222-4222-8222-000000000009'::uuid, 'western-guitar', 750.00,
   '/credentials/fatima-rockschool.pdf',
   'Rockschool Grade 6 Guitar, 2019. Three years teaching at a Hennur music school.', 'approved'),
  ('55555555-5555-4555-8555-000000000010'::uuid, '22222222-2222-4222-8222-000000000010'::uuid, 'football', 700.00,
   '/credentials/girish-school-letter.pdf',
   'Appointment letter, Whitefield Global School, PE department, 2018.', 'approved'),
  ('55555555-5555-4555-8555-000000000013'::uuid, '22222222-2222-4222-8222-000000000011'::uuid, 'hindustani-vocal', 750.00,
   '/credentials/meenakshi-gwalior.pdf',
   'Visharad, Gwalior gharana lineage, Akhil Bharatiya Gandharva Mahavidyalaya Mandal, 2010.', 'approved'),
  ('55555555-5555-4555-8555-000000000014'::uuid, '22222222-2222-4222-8222-000000000012'::uuid, 'keyboard-piano', 700.00,
   '/credentials/arjun-trinity-grade8.pdf',
   'Trinity College London Grade 8 Piano, distinction, 2015.', 'approved'),
  ('55555555-5555-4555-8555-000000000015'::uuid, '22222222-2222-4222-8222-000000000013'::uuid, 'bharatanatyam', 850.00,
   '/credentials/kavya-arangetram.pdf',
   'Arangetram certificate, 2009. Twelve years under Guru Meenakshi Chitharanjan, Chennai.', 'approved'),
  ('55555555-5555-4555-8555-000000000016'::uuid, '22222222-2222-4222-8222-000000000015'::uuid, 'cricket', 650.00,
   '/credentials/vikram-bcci-l1.pdf',
   'BCCI Level 1 coaching certification, 2017. District age-group coach, 2018–present.', 'approved'),
  ('55555555-5555-4555-8555-000000000017'::uuid, '22222222-2222-4222-8222-000000000016'::uuid, 'badminton', 700.00,
   '/credentials/ayesha-state-badminton.pdf',
   'Karnataka state championship, singles semi-finalist, 2011. BAI certified coach.', 'approved'),
  -- Pending: the approvals queue has something real to act on.
  ('55555555-5555-4555-8555-000000000011'::uuid, '22222222-2222-4222-8222-000000000004'::uuid, 'carnatic-vocal', 900.00,
   '/credentials/anand-carnatic-claim.pdf',
   'Self-declared: eight years of informal Carnatic training at home. No certificate attached.', 'pending'),
  ('55555555-5555-4555-8555-000000000012'::uuid, '22222222-2222-4222-8222-000000000010'::uuid, 'chess', 450.00,
   '/credentials/girish-chess-club.pdf',
   'Runs the school chess club. State-level participation certificate, 2016. No coaching certification.', 'pending'),
  ('55555555-5555-4555-8555-000000000018'::uuid, '22222222-2222-4222-8222-000000000014'::uuid, 'hip-hop-dance', 600.00,
   '/credentials/rahul-crew-record.pdf',
   'Self-declared: five years with a Bangalore street dance crew, two regional battle wins. No formal certification.', 'pending')
) as v(id, trainer, slug, rate, url, note, st)
join public.categories c on c.slug = v.slug;

-- ---------------------------------------------------------------- enrollment A — the spine

-- Aarav has been sketching with Priya for five weeks. This is what makes the parent's
-- progress spine non-empty on first load, which is the whole argument of the product.
insert into public.enquiries (id, parent_id, child_id, trainer_id, category_id, message, status, responded_at, created_at)
select '66666666-6666-4666-8666-000000000001',
       '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001',
       '22222222-2222-4222-8222-000000000005', c.id,
       'Aarav draws constantly but only ever copies from his tablet. Can you get him drawing from life?',
       'accepted', now() - interval '37 days', now() - interval '38 days'
from public.categories c where c.slug = 'sketching';

insert into public.enrollments
  (id, enquiry_id, parent_id, child_id, trainer_id, category_id, rate_per_class, classes_per_month, created_at)
select '77777777-7777-4777-8777-000000000001', '66666666-6666-4666-8666-000000000001',
       '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000001',
       '22222222-2222-4222-8222-000000000005', c.id, 500.00, 8, now() - interval '37 days'
from public.categories c where c.slug = 'sketching';

-- Real money path: topup + hold, and the month's eight sessions.
select public.fund_enrollment('77777777-7777-4777-8777-000000000001');

-- fund_enrollment schedules weekly from today. Shift the whole month back five weeks so
-- there is history to show, and so exactly one class lands today.
update public.enrollments set start_date = current_date - 35
 where id = '77777777-7777-4777-8777-000000000001';
update public.sessions
   set scheduled_at = scheduled_at - interval '35 days'
 where enrollment_id = '77777777-7777-4777-8777-000000000001';

-- ---------------------------------------------------------------- enrollment B

-- Ishaan learns Carnatic vocal with Lakshmi. Gives the demo trainer a populated Today
-- screen and a non-empty earnings ledger before anyone touches anything.
insert into public.enquiries (id, parent_id, child_id, trainer_id, category_id, message, status, responded_at, created_at)
select '66666666-6666-4666-8666-000000000002',
       '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000003',
       '22222222-2222-4222-8222-000000000001', c.id,
       'Ishaan has done two years of keyboard and wants to sing. Is eleven too late to start?',
       'accepted', now() - interval '23 days', now() - interval '24 days'
from public.categories c where c.slug = 'carnatic-vocal';

insert into public.enrollments
  (id, enquiry_id, parent_id, child_id, trainer_id, category_id, rate_per_class, classes_per_month, created_at)
select '77777777-7777-4777-8777-000000000002', '66666666-6666-4666-8666-000000000002',
       '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000003',
       '22222222-2222-4222-8222-000000000001', c.id, 800.00, 8, now() - interval '23 days'
from public.categories c where c.slug = 'carnatic-vocal';

select public.fund_enrollment('77777777-7777-4777-8777-000000000002');

update public.enrollments set start_date = current_date - 21
 where id = '77777777-7777-4777-8777-000000000002';
update public.sessions
   set scheduled_at = scheduled_at - interval '21 days'
 where enrollment_id = '77777777-7777-4777-8777-000000000002';

-- ---------------------------------------------------------------- attendance history

-- Every one of these UPDATEs fires trg_release_session_funds. Nothing below writes a
-- ledger row by hand — if the trigger stops working, the seed stops producing money.
create or replace function pg_temp.mark(
  p_enrollment uuid, p_offset_days integer, p_note text, p_rating integer, p_focus text[]
) returns void language plpgsql as $fn$
declare v_id uuid;
begin
  select id into v_id from public.sessions
   where enrollment_id = p_enrollment
     and scheduled_at::date = (current_date - p_offset_days);
  if v_id is null then raise exception 'No seeded session % days back', p_offset_days; end if;

  update public.sessions
     set status = 'attended', assessment_note = p_note, skill_rating = p_rating, focus_areas = p_focus
   where id = v_id;

  -- The trigger stamps attendance_marked_at = now(); backdate it so the spine reads as
  -- history. Status is not in this UPDATE, so the trigger does not fire again.
  update public.sessions
     set attendance_marked_at = (current_date - p_offset_days) + time '18:00'
   where id = v_id;
end $fn$;

-- Aarav · sketching with Priya · five weeks, five classes delivered
select pg_temp.mark('77777777-7777-4777-8777-000000000001', 35,
  'First session. Aarav can already draw a convincing cartoon but freezes in front of a real object. We spent the hour on a single shoe — no erasing allowed. He hated it for twenty minutes and then got absorbed.',
  2, array['observation','line confidence']);
select pg_temp.mark('77777777-7777-4777-8777-000000000001', 28,
  'Contour drawing of a potted money plant. Still drawing what he thinks a leaf looks like rather than what is in front of him, but he caught himself twice and corrected without being told. That is the whole skill.',
  2, array['observation','proportion']);
select pg_temp.mark('77777777-7777-4777-8777-000000000001', 21,
  'Introduced negative space. Drew the gaps between the chair legs instead of the legs. Result was the most accurate thing he has made so far and he could see it. Asked to take the drawing home.',
  3, array['negative space','proportion']);
select pg_temp.mark('77777777-7777-4777-8777-000000000001', 14,
  'Value study, three tones only, using the side of the pencil. Struggled to keep his hand loose and kept reverting to the tip. Grip is the thing to work on next week.',
  3, array['tonal value','pencil grip']);
select pg_temp.mark('77777777-7777-4777-8777-000000000001', 7,
  'Best session yet. Drew his own hand holding a spoon — foreshortening, which is genuinely hard — and did not once ask if it was good. Proportions are landing without correction now.',
  4, array['foreshortening','observation','confidence']);

-- Ishaan · Carnatic vocal with Lakshmi · three weeks, three classes delivered
select pg_temp.mark('77777777-7777-4777-8777-000000000002', 21,
  'Assessed range and shruti. Comfortable between G and D, which is a good starting sthayi for him. Started Sarali Varisai one and two. His keyboard training shows — he hears intervals well.',
  3, array['shruti','sarali varisai']);
select pg_temp.mark('77777777-7777-4777-8777-000000000002', 14,
  'Sarali Varisai one to four at two speeds. Second speed is rushed and he loses the tala. Made him keep tala with his hand and sing slower than felt natural. Much better by the end.',
  3, array['tala','sarali varisai','tempo control']);
select pg_temp.mark('77777777-7777-4777-8777-000000000002', 7,
  'Janta Varisai introduced. The doubled notes are catching him out on the breath, so we did breathing exercises for ten minutes first. Tala is holding steady now even at the faster speed.',
  4, array['janta varisai','breath control','tala']);

-- ---------------------------------------------------------------- calendar states

-- The month grids need every state reachable, not just the happy one. After the two
-- enrollments above there are attended classes in the past and scheduled ones ahead;
-- these fill in the two states that only appear when something goes wrong.

-- A no-show: the trainer turned up, the child did not. No money is released — the
-- release trigger only fires on 'attended' — but the parent is told and it is on record.
update public.sessions s
   set status = 'no_show',
       assessment_note = 'Waited twenty minutes at the gate. Nobody came down and the phone rang out.',
       attendance_marked_at = s.scheduled_at + interval '30 minutes'
 where s.id = (
   select id from public.sessions
    where enrollment_id = '77777777-7777-4777-8777-000000000002'
      and status = 'scheduled' and scheduled_at < now()
    order by scheduled_at desc limit 1);

-- Anitha is the demo parent, so her calendar needs every state on it too. A no-show on
-- her sketching month: the trainer travelled, the child was not there. No money moves —
-- the release trigger only fires on 'attended' — but it is on the record either way.
insert into public.sessions (enrollment_id, scheduled_at, status, assessment_note, attendance_marked_at)
values ('77777777-7777-4777-8777-000000000001',
        ((current_date - 11) + time '17:00') at time zone 'Asia/Kolkata',
        'no_show',
        'Rang the bell for ten minutes. Found out later they were stuck in traffic coming back from school.',
        ((current_date - 11) + time '17:30') at time zone 'Asia/Kolkata');

-- A class that came and went unmarked. This is the one that matters: a parent's money
-- sitting in escrow with nothing recorded against it. It shows red on both calendars
-- and is what the admin stall detector is looking for.
insert into public.sessions (enrollment_id, scheduled_at, status)
values ('77777777-7777-4777-8777-000000000001',
        ((current_date - 4) + time '17:00') at time zone 'Asia/Kolkata', 'scheduled');

-- Interests and delivery preference, so the parent onboarding fields have seeded
-- equivalents and the search mode filter has something to match against.
update public.children set interests = array['music','drawing'], preferred_mode = 'either'
 where id = '44444444-4444-4444-8444-000000000001';
update public.children set interests = array['swimming'], preferred_mode = 'in_person'
 where id = '44444444-4444-4444-8444-000000000002';
update public.children set interests = array['music','chess'], preferred_mode = 'online'
 where id = '44444444-4444-4444-8444-000000000003';

-- ---------------------------------------------------------------- an open enquiry

-- So the trainer's enquiries screen is not empty before the demo starts.
insert into public.enquiries (parent_id, child_id, trainer_id, category_id, message, created_at)
select '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000003',
       '22222222-2222-4222-8222-000000000006', c.id,
       'Ishaan plays at school but has never been coached. Weekend slots only, if you have them.',
       now() - interval '2 days'
from public.categories c where c.slug = 'football';

-- ---------------------------------------------------------------- sanity checks

-- The seed refuses to load quietly if an invariant has broken.
do $do$
declare
  v_releases    integer;
  v_commissions integer;
  v_platform    numeric;
  v_escrow_a    numeric;
begin
  select count(*) into v_releases    from public.ledger_entries where type = 'release';
  select count(*) into v_commissions from public.ledger_entries where type = 'commission';
  if v_releases <> 8 or v_commissions <> 8 then
    raise exception 'Expected 8 releases and 8 commissions from the trigger, got % and %',
      v_releases, v_commissions;
  end if;

  -- 5 sketching classes at 500 + 3 vocal at 800 = 4900, 15% of which is 735.
  select balance into v_platform from public.account_balances
   where owner_id is null and type = 'platform_revenue';
  if v_platform <> 735.00 then
    raise exception 'Platform revenue should be 735.00, got %', v_platform;
  end if;

  -- Enrollment A: 4000 committed, 5 classes released, 1500 still held.
  select coalesce(sum(amount) filter (where type = 'hold'), 0)
       - coalesce(sum(amount) filter (where type in ('release','commission','refund')), 0)
    into v_escrow_a
    from public.ledger_entries where enrollment_id = '77777777-7777-4777-8777-000000000001';
  if v_escrow_a <> 1500.00 then
    raise exception 'Enrollment A should hold 1500.00 in escrow, got %', v_escrow_a;
  end if;

  raise notice 'Seed OK — % releases, platform revenue %, enrollment A escrow %',
    v_releases, v_platform, v_escrow_a;
  raise notice 'Calendar states — % attended, % no-show, % unmarked in the past',
    (select count(*) from public.sessions where status = 'attended'),
    (select count(*) from public.sessions where status = 'no_show'),
    (select count(*) from public.sessions where status = 'scheduled' and scheduled_at < now());
end $do$;
