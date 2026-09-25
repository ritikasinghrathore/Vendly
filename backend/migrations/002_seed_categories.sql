-- Default product categories shared by every shop (English + Hindi).
insert into categories (name, name_hi, sort_order) values
  ('Grocery',            'किराना',            1),
  ('Rice & Grains',      'चावल और अनाज',      2),
  ('Pulses',             'दालें',              3),
  ('Flour',              'आटा',               4),
  ('Oil & Ghee',         'तेल और घी',         5),
  ('Spices',             'मसाले',             6),
  ('Snacks',             'नमकीन और बिस्कुट',  7),
  ('Beverages',          'पेय',               8),
  ('Dairy',              'डेयरी',             9),
  ('Vegetables & Fruits','सब्ज़ी और फल',      10),
  ('Household',          'घरेलू सामान',       11),
  ('Puja Items',         'पूजा सामग्री',      12),
  ('Stationery',         'स्टेशनरी',          13),
  ('Other',              'अन्य',              99)
on conflict (name) do nothing;
