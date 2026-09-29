CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(30) NOT NULL,
    last_name VARCHAR(40) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    bio VARCHAR(1000),
    reputation_score INT NOT NULL DEFAULT 0,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE storefronts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description VARCHAR(1000),
    theme VARCHAR(20) NOT NULL DEFAULT 'theme-1' CHECK (theme IN ('theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5')),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_storefronts_owner ON storefronts(owner_id);

CREATE TABLE product_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(20) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    format VARCHAR(50),
    film_type VARCHAR(50),
    camera_type VARCHAR(50),
    accessory_type VARCHAR(50),
    compatible_formats VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (product_type, brand, name, format, film_type, accessory_type)
);

CREATE INDEX idx_product_catalog_type ON product_catalog(product_type);
CREATE INDEX idx_product_catalog_brand ON product_catalog(brand);
CREATE INDEX idx_product_catalog_format ON product_catalog(format);
CREATE INDEX idx_product_catalog_active ON product_catalog(active);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
    catalog_product_id UUID NOT NULL REFERENCES product_catalog(id),
    slug VARCHAR(255) NOT NULL,
    title_override VARCHAR(255),
    description VARCHAR(1000),
    price_cents INT NOT NULL CHECK (price_cents >= 0),
    available_quantity INT NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    working_condition VARCHAR(20),
    has_mods BOOLEAN,
    expiry_date DATE,
    storage_condition VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_storefront ON products(storefront_id);
CREATE INDEX idx_products_catalog_product ON products(catalog_product_id);
CREATE INDEX idx_products_status ON products(status);
CREATE UNIQUE INDEX idx_products_storefront_slug ON products(storefront_id, slug);

CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
 
CREATE INDEX idx_product_images_product ON product_images(product_id);

CREATE TABLE carts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    cart_user_id UUID NOT NULL REFERENCES carts(user_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (cart_user_id, product_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id),
    storefront_id UUID NOT NULL REFERENCES storefronts(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_storefront ON orders(storefront_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    product_type VARCHAR(20) NOT NULL,
    unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

INSERT INTO users (
    id,
    first_name,
    last_name,
    display_name,
    password_hash,
    email,
    bio,
    reputation_score, 
    role
) VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'Admin',
        'User',
        'Filmplace Admin',
        crypt('adminpw123', gen_salt('bf', 12)),
        'admin@mail.com',
        'Keeping instant photography practical, repairable, and in circulation.',
        100,
        'ADMIN'
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        'Jan',
        'Horvat',
        'jan556',
        crypt('userpw123', gen_salt('bf', 12)),
        'jan@mail.com',
        'Film collector and cold-storage enthusiast. I love imperfect frames and expired packs with character.',
        42,
        'USER'
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'John',
        'Reed',
        'Instant John',
        crypt('userpw123', gen_salt('bf', 12)),
        'john@mail.com',
        'Always looking for the small parts that keep favorite instant cameras working.',
        18,
        'USER'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO storefronts (
    id,
    owner_id,
    name,
    slug,
    description
) VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Admin store',
        'admin-store',
        'Placeholder storefront with tested instant cameras and starter gear.'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002',
        'Janov ducan',
        'janov-ducan',
        'Moj ducan za polaroide i instax.'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000003',
        'John Accessories',
        'john-accessories',
        'Cases, flashes, straps, and small replacement parts.'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_catalog (
    id,
    product_type,
    brand,
    name,
    format,
    film_type,
    camera_type,
    accessory_type,
    compatible_formats
) VALUES
    (
        '60000000-0000-0000-0000-000000000001',
        'CAMERA',
        'POLAROID',
        'Polaroid SX-70 Land Camera',
        'SX-70',
        NULL,
        'FOLDING',
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        'CAMERA',
        'POLAROID',
        'Polaroid 600 OneStep',
        '600',
        NULL,
        'BOX',
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000003',
        'CAMERA',
        'INSTAX',
        'Instax Mini 12',
        'INSTAX MINI',
        NULL,
        'POINT_AND_SHOOT',
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000004',
        'FILM',
        'POLAROID',
        'Polaroid 600 Color',
        '600',
        'COLOR',
        NULL,
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000005',
        'FILM',
        'POLAROID',
        'Polaroid I-Type B/W',
        'I-TYPE',
        'MONOCHROME',
        NULL,
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000006',
        'FILM',
        'POLAROID',
        'Polaroid I-Type Black Border',
        'I-TYPE',
        'BLACK_BORDER',
        NULL,
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000007',
        'FILM',
        'INSTAX',
        'Instax Mini Color',
        'INSTAX MINI',
        'COLOR',
        NULL,
        NULL,
        NULL
    ),
    (
        '60000000-0000-0000-0000-000000000008',
        'ACCESSORY',
        'POLAROID',
        'Vintage Camera Strap',
        NULL,
        NULL,
        NULL,
        'STRAP',
        'SX-70, 600, I-TYPE'
    ),
    (
        '60000000-0000-0000-0000-000000000009',
        'ACCESSORY',
        'POLAROID',
        'Polaroid 600 Close-Up Lens',
        NULL,
        NULL,
        NULL,
        'LENS',
        '600'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_catalog (
    id,
    product_type,
    brand,
    name,
    format,
    film_type,
    camera_type,
    accessory_type,
    compatible_formats
) VALUES
    ('60000000-0000-0000-0000-000000000010', 'CAMERA', 'POLAROID', 'Polaroid I-2', 'I-TYPE', NULL, 'ANALOG', NULL, 'I-TYPE, 600, SX-70'),
    ('60000000-0000-0000-0000-000000000011', 'CAMERA', 'POLAROID', 'Polaroid Flip', 'I-TYPE', NULL, 'POINT_AND_SHOOT', NULL, 'I-TYPE, 600'),
    ('60000000-0000-0000-0000-000000000012', 'CAMERA', 'POLAROID', 'Polaroid Now+ Generation 2', 'I-TYPE', NULL, 'POINT_AND_SHOOT', NULL, 'I-TYPE, 600'),
    ('60000000-0000-0000-0000-000000000013', 'CAMERA', 'POLAROID', 'Polaroid Now Generation 2', 'I-TYPE', NULL, 'POINT_AND_SHOOT', NULL, 'I-TYPE, 600'),
    ('60000000-0000-0000-0000-000000000014', 'CAMERA', 'POLAROID', 'Polaroid Go Generation 2', 'GO', NULL, 'POINT_AND_SHOOT', NULL, 'GO'),
    ('60000000-0000-0000-0000-000000000015', 'CAMERA', 'POLAROID', 'Polaroid SX-70 Sonar', 'SX-70', NULL, 'FOLDING', NULL, 'SX-70'),
    ('60000000-0000-0000-0000-000000000016', 'CAMERA', 'POLAROID', 'Polaroid Sun 660 AutoFocus', '600', NULL, 'BOX', NULL, '600'),
    ('60000000-0000-0000-0000-000000000017', 'CAMERA', 'POLAROID', 'Polaroid Impulse AF', '600', NULL, 'BOX', NULL, '600'),
    ('60000000-0000-0000-0000-000000000018', 'CAMERA', 'POLAROID', 'Polaroid SLR 680', '600', NULL, 'FOLDING', NULL, '600'),
    ('60000000-0000-0000-0000-000000000019', 'FILM', 'POLAROID', 'Polaroid I-Type Color', 'I-TYPE', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000022', 'FILM', 'POLAROID', 'Polaroid 600 B/W', '600', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000023', 'FILM', 'POLAROID', 'Polaroid SX-70 Color', 'SX-70', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000024', 'FILM', 'POLAROID', 'Polaroid SX-70 B/W', 'SX-70', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000025', 'FILM', 'POLAROID', 'Polaroid Go Color', 'GO', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000026', 'FILM', 'POLAROID', 'Polaroid 8x10 Color', '8X10', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000027', 'FILM', 'POLAROID', 'Polaroid 8x10 B/W', '8X10', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000028', 'CAMERA', 'INSTAX', 'Instax Mini 41', 'INSTAX MINI', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX MINI'),
    ('60000000-0000-0000-0000-000000000029', 'CAMERA', 'INSTAX', 'Instax Mini 99', 'INSTAX MINI', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX MINI'),
    ('60000000-0000-0000-0000-000000000030', 'CAMERA', 'INSTAX', 'Instax Mini Evo', 'INSTAX MINI', NULL, 'HYBRID', NULL, 'INSTAX MINI'),
    ('60000000-0000-0000-0000-000000000031', 'CAMERA', 'INSTAX', 'Instax Mini LiPlay', 'INSTAX MINI', NULL, 'HYBRID', NULL, 'INSTAX MINI'),
    ('60000000-0000-0000-0000-000000000032', 'CAMERA', 'INSTAX', 'Instax WIDE 400', 'INSTAX WIDE', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX WIDE'),
    ('60000000-0000-0000-0000-000000000033', 'CAMERA', 'INSTAX', 'Instax WIDE 300', 'INSTAX WIDE', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX WIDE'),
    ('60000000-0000-0000-0000-000000000034', 'CAMERA', 'INSTAX', 'Instax SQUARE SQ1', 'INSTAX SQUARE', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX SQUARE'),
    ('60000000-0000-0000-0000-000000000035', 'CAMERA', 'INSTAX', 'Instax SQUARE SQ40', 'INSTAX SQUARE', NULL, 'POINT_AND_SHOOT', NULL, 'INSTAX SQUARE'),
    ('60000000-0000-0000-0000-000000000036', 'FILM', 'INSTAX', 'Instax Mini Monochrome', 'INSTAX MINI', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000037', 'FILM', 'INSTAX', 'Instax Mini Black Border', 'INSTAX MINI', 'BLACK_BORDER', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000038', 'FILM', 'INSTAX', 'Instax Square Color', 'INSTAX SQUARE', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000039', 'FILM', 'INSTAX', 'Instax Square Monochrome', 'INSTAX SQUARE', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000040', 'FILM', 'INSTAX', 'Instax Square Black Border', 'INSTAX SQUARE', 'BLACK_BORDER', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000041', 'FILM', 'INSTAX', 'Instax Wide Color', 'INSTAX WIDE', 'COLOR', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000042', 'FILM', 'INSTAX', 'Instax Wide Monochrome', 'INSTAX WIDE', 'MONOCHROME', NULL, NULL, NULL),
    ('60000000-0000-0000-0000-000000000043', 'FILM', 'INSTAX', 'Instax Wide Black Border', 'INSTAX WIDE', 'BLACK_BORDER', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (
    id,
    storefront_id,
    catalog_product_id,
    slug,
    title_override,
    description,
    price_cents,
    available_quantity,
    status,
    working_condition,
    has_mods,
    expiry_date,
    storage_condition
) VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001',
        'polaroid-sx-70-land-camera',
        NULL,
        'Foldable instant camera with clean rollers and tested shutter.',
        12900,
        2,
        'ACTIVE',
        'TESTED',
        false,
        NULL,
        NULL
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000002',
        'polaroid-600-onestep',
        NULL,
        'Simple point-and-shoot camera for 600 film.',
        5900,
        1,
        'ACTIVE',
        'USED',
        false,
        NULL,
        NULL
    ),
    (
        '20000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000003',
        'instax-mini-12',
        NULL,
        'Compact Instax Mini 12 in excellent working condition. Includes wrist strap.',
        7499,
        1,
        'ACTIVE',
        'TESTED',
        false,
        NULL,
        NULL
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000004',
        'polaroid-600-color',
        NULL,
        'Fresh color instant film pack.',
        1899,
        8,
        'ACTIVE',
        NULL,
        NULL,
        '2027-08-01',
        'COLD_STORED'
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000005',
        'polaroid-i-type-b-w',
        NULL,
        'Monochrome i-Type film for newer Polaroid cameras.',
        1799,
        5,
        'ACTIVE',
        NULL,
        NULL,
        '2027-05-01',
        'COLD_STORED'
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000003',
        '60000000-0000-0000-0000-000000000008',
        'vintage-camera-strap',
        NULL,
        'Adjustable woven strap with metal clips.',
        1200,
        6,
        'ACTIVE',
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        '20000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000003',
        '60000000-0000-0000-0000-000000000009',
        'polaroid-600-close-up-lens',
        NULL,
        'Clip-on close-up lens for compatible 600 box cameras.',
        1500,
        0,
        'SOLD',
        NULL,
        NULL,
        NULL,
        NULL
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_images (
    id,
    product_id,
    image_url,
    sort_order
) VALUES
    (
        '30000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '/images/sx-70-1.jpeg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000007',
        '20000000-0000-0000-0000-000000000001',
        '/images/sx-70-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000008',
        '20000000-0000-0000-0000-000000000001',
        '/images/sx-70-3.jpeg',
        2
    ),
    (
        '30000000-0000-0000-0000-000000000009',
        '20000000-0000-0000-0000-000000000001',
        '/images/sx-70-4.jpg',
        3
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        '/images/600-onestep.jpg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000010',
        '20000000-0000-0000-0000-000000000002',
        '/images/600-onestep-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000011',
        '20000000-0000-0000-0000-000000000002',
        '/images/600-onestep-3.jpeg',
        2
    ),
    (
        '30000000-0000-0000-0000-000000000006',
        '20000000-0000-0000-0000-000000000007',
        '/images/instax-mini-12-1.jpeg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000012',
        '20000000-0000-0000-0000-000000000007',
        '/images/instax-mini-12-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000003',
        '/images/polaroid-600-color-1.jpeg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000013',
        '20000000-0000-0000-0000-000000000003',
        '/images/polaroid-600-color-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000014',
        '20000000-0000-0000-0000-000000000003',
        '/images/polaroid-600-color-3.jpeg',
        2
    ),
    (
        '30000000-0000-0000-0000-000000000015',
        '20000000-0000-0000-0000-000000000003',
        '/images/polaroid-600-color-4.jpeg',
        3
    ),
    (
        '30000000-0000-0000-0000-000000000016',
        '20000000-0000-0000-0000-000000000003',
        '/images/polaroid-600-color-5.jpeg',
        4
    ),
    (
        '30000000-0000-0000-0000-000000000004',
        '20000000-0000-0000-0000-000000000004',
        '/images/polaroid-itype-bw-1.jpg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000017',
        '20000000-0000-0000-0000-000000000004',
        '/images/polaroid-itype-bw-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000018',
        '20000000-0000-0000-0000-000000000004',
        '/images/polaroid-itype-bw-3.jpeg',
        2
    ),
    (
        '30000000-0000-0000-0000-000000000005',
        '20000000-0000-0000-0000-000000000005',
        '/images/polaroid-vintage-camera-strap-1.jpeg',
        0
    ),
    (
        '30000000-0000-0000-0000-000000000019',
        '20000000-0000-0000-0000-000000000005',
        '/images/polaroid-vintage-camera-strap-2.jpeg',
        1
    ),
    (
        '30000000-0000-0000-0000-000000000020',
        '20000000-0000-0000-0000-000000000006',
        '/images/polaroid-600-close-up%20lens.jpeg',
        0
    )
ON CONFLICT (id) DO UPDATE
SET image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order;

INSERT INTO carts (
    user_id
) VALUES
    ('00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO cart_items (
    cart_user_id,
    product_id,
    quantity
) VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000003',
        2
    ),
    (
        '00000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        1
    )
ON CONFLICT (cart_user_id, product_id) DO NOTHING;

INSERT INTO orders (
    id,
    buyer_id,
    storefront_id,
    status,
    total_cents
) VALUES
    (
        '40000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'COMPLETED',
        5900
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'PENDING',
        3798
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (
    id,
    order_id,
    product_id,
    title,
    product_type,
    unit_price_cents,
    quantity
) VALUES
    (
        '50000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000002',
        'Polaroid 600 OneStep',
        'CAMERA',
        5900,
        1
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000003',
        'Color 600 Film',
        'FILM',
        1899,
        2
    )
ON CONFLICT (id) DO NOTHING;
