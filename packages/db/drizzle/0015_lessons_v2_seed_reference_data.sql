INSERT INTO "lesson_categories" ("name", "sort_order")
VALUES
  ('Engineering', 10),
  ('Procurement', 20),
  ('Construction', 30),
  ('Installation', 40),
  ('Commissioning', 50),
  ('HSE', 60),
  ('Commercial', 70),
  ('Project Management', 80),
  ('Quality', 90),
  ('Other', 100)
ON CONFLICT ("name") DO NOTHING;
