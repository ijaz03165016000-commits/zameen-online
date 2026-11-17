// Sample data used in DEMO MODE and by the admin "Load sample data" button.
const U = (id, w = 900) => `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;

export const IMG = {
  house1: U("photo-1580587771525-78b9dba3b914"),
  house2: U("photo-1564013799919-ab600027ffc6"),
  house3: U("photo-1600596542815-ffad4c1539a9"),
  house4: U("photo-1600585154340-be6161a56a0c"),
  house5: U("photo-1512917774080-9991f1c4c750"),
  house6: U("photo-1568605114967-8130f3a36994"),
  house7: U("photo-1570129477492-45c003edd2be"),
  house8: U("photo-1613490493576-7fde63acd811"),
  interior1: U("photo-1600607687939-ce8a6c25118c"),
  interior2: U("photo-1560448204-e02f11c3d0e2"),
  interior3: U("photo-1502672260266-1c1ef2d93688"),
  apt1: U("photo-1545324418-cc1a3fa10c00"),
  apt2: U("photo-1522708323590-d24dbb6b0267"),
  land1: U("photo-1500382017468-9049fed747ef"),
  land2: U("photo-1464822759023-fed622ff2c3b"),
  office1: U("photo-1486406146926-c627a92ad1ab"),
  office2: U("photo-1497366216548-37526070297c"),
  shop1: U("photo-1441986300917-64674bd600d8")
};

const day = 86400000;
const now = Date.now();

export const SEED_LISTINGS = [
  { title: "10 Marla Brand New Double Storey House", purpose: "sale", type: "house", city: "Mirpur AJK", location: "Sector F-1, Mirpur", price: 28500000, area: 10, areaUnit: "Marla", beds: 5, baths: 5, featured: true, images: [IMG.house1, IMG.interior1, IMG.interior2], description: "Beautiful brand new double storey house in the heart of Sector F-1.\n\n• 5 bedrooms with attached baths\n• Drawing & dining, TV lounge\n• Modern kitchen with cabinets\n• Car porch for 2 cars\n• Near Mirpur Chowk and main markets\n\nClear title, all documents ready for transfer." },
  { title: "1 Kanal Luxury Villa with Lawn — Mangla View", purpose: "sale", type: "house", city: "Mirpur AJK", location: "Allama Iqbal Road, Mirpur", price: 65000000, area: 1, areaUnit: "Kanal", beds: 6, baths: 7, featured: true, images: [IMG.house8, IMG.interior1, IMG.house3], description: "Stunning 1 kanal villa with a beautiful view of Mangla Lake.\n\nImported fittings, solar system installed, servant quarter, big lawn and 24/7 security." },
  { title: "5 Marla Residential Plot — Ideal Location", purpose: "sale", type: "plot", city: "Mirpur AJK", location: "New City Phase 2, Mirpur", price: 4200000, area: 5, areaUnit: "Marla", beds: 0, baths: 0, featured: false, images: [IMG.land1], description: "Level residential plot on a 30 ft road. Possession available. Electricity and gas lines nearby." },
  { title: "Furnished 2 Bed Apartment for Rent", purpose: "rent", type: "apartment", city: "Mirpur AJK", location: "Kotli Road, Mirpur", price: 45000, area: 1100, areaUnit: "Sq Ft", beds: 2, baths: 2, featured: true, images: [IMG.apt2, IMG.interior3, IMG.interior2], description: "Fully furnished apartment on 2nd floor. Lift, backup generator and parking available. Family preferred." },
  { title: "8 Marla House Near Chattar Klas", purpose: "sale", type: "house", city: "Muzaffarabad", location: "Chattar Klas, Muzaffarabad", price: 19500000, area: 8, areaUnit: "Marla", beds: 4, baths: 3, featured: true, images: [IMG.house6, IMG.interior2], description: "Well-maintained family house with mountain view, near University of AJK and main road." },
  { title: "Commercial Shop on Main Bazaar", purpose: "rent", type: "shop", city: "Muzaffarabad", location: "Madina Market, Muzaffarabad", price: 60000, area: 350, areaUnit: "Sq Ft", beds: 0, baths: 1, featured: false, images: [IMG.shop1], description: "Ground floor shop on busy main bazaar. Ideal for garments, mobile or pharmacy business." },
  { title: "2 Kanal Agricultural Land with River View", purpose: "sale", type: "land", city: "Rawalakot", location: "Banjosa Road, Rawalakot", price: 12000000, area: 2, areaUnit: "Kanal", beds: 0, baths: 0, featured: true, images: [IMG.land2, IMG.land1], description: "Scenic land near Banjosa Lake — perfect for a guest house, resort or farm house." },
  { title: "6 Marla Single Storey House", purpose: "rent", type: "house", city: "Rawalakot", location: "Hajira Road, Rawalakot", price: 35000, area: 6, areaUnit: "Marla", beds: 3, baths: 2, featured: false, images: [IMG.house7], description: "Single storey house with small lawn, available for families. Water and electricity available." },
  { title: "10 Marla Plot in Housing Scheme", purpose: "sale", type: "plot", city: "Kotli", location: "Tatta Pani Road, Kotli", price: 6500000, area: 10, areaUnit: "Marla", beds: 0, baths: 0, featured: false, images: [IMG.land1], description: "Corner plot, 40 ft road, near school and mosque." },
  { title: "Newly Built 7 Marla House", purpose: "sale", type: "house", city: "Bhimber", location: "Samahni Road, Bhimber", price: 14500000, area: 7, areaUnit: "Marla", beds: 4, baths: 4, featured: false, images: [IMG.house2, IMG.interior1], description: "Newly constructed house with modern design, marble flooring and wooden work." },
  { title: "3 Bed Luxury Apartment — Gulberg Greens", purpose: "sale", type: "apartment", city: "Islamabad", location: "Gulberg Greens, Islamabad", price: 32000000, area: 1850, areaUnit: "Sq Ft", beds: 3, baths: 3, featured: true, images: [IMG.apt1, IMG.interior3, IMG.interior1], description: "Luxury apartment with gym, pool and 24/7 security. Near Islamabad Expressway." },
  { title: "Office Space for Rent — Blue Area", purpose: "rent", type: "office", city: "Islamabad", location: "Blue Area, Islamabad", price: 250000, area: 2400, areaUnit: "Sq Ft", beds: 0, baths: 2, featured: false, images: [IMG.office1, IMG.office2], description: "Corporate office floor with lift, central AC and dedicated parking." },
  { title: "1 Kanal House in DHA Phase 6", purpose: "sale", type: "house", city: "Lahore", location: "DHA Phase 6, Lahore", price: 95000000, area: 1, areaUnit: "Kanal", beds: 5, baths: 6, featured: true, images: [IMG.house3, IMG.interior2, IMG.interior1], description: "Modern design bungalow with basement, home theater and fully equipped kitchen." },
  { title: "5 Marla House in Bahria Town", purpose: "rent", type: "house", city: "Lahore", location: "Bahria Town, Lahore", price: 70000, area: 5, areaUnit: "Marla", beds: 3, baths: 3, featured: false, images: [IMG.house5], description: "Neat and clean house in a secure society, close to park and commercial area." },
  { title: "240 Sq Yd Bungalow — Gulshan-e-Iqbal", purpose: "sale", type: "house", city: "Karachi", location: "Gulshan-e-Iqbal Block 13, Karachi", price: 52000000, area: 240, areaUnit: "Sq Yd", beds: 4, baths: 4, featured: false, images: [IMG.house4], description: "West open bungalow, leased, near Maskan Chowrangi." },
  { title: "Commercial Building on Murree Road", purpose: "sale", type: "building", city: "Rawalpindi", location: "Murree Road, Rawalpindi", price: 180000000, area: 12, areaUnit: "Marla", beds: 0, baths: 6, featured: false, images: [IMG.office1], description: "Four-storey commercial building with rental income. Prime location on Murree Road." }
].map((l, i) => ({
  ...l,
  id: "demo-" + (i + 1),
  status: "approved",
  ownerId: i % 3 === 0 ? "dealer-1" : i % 3 === 1 ? "dealer-2" : "dealer-3",
  ownerName: ["Kashmir Estate Advisors", "Mangla Properties", "Pakistan Realty Hub"][i % 3],
  phone: "+92 344 0807888",
  whatsapp: "923440807888",
  views: 40 + i * 17,
  createdAt: now - i * day * 1.7
}));

export const SEED_DEALERS = [
  { name: "Kashmir Estate Advisors", owner: "Raja Imran", city: "Mirpur AJK", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Elite", listings: 142, about: "Trusted property advisors in Mirpur since 2008. Houses, plots and overseas Kashmiri investment." },
  { name: "Mangla Properties", owner: "Ch. Waqas", city: "Mirpur AJK", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Platinum", listings: 88, about: "Specialists in Mangla view houses and New City plots." },
  { name: "Pakistan Realty Hub", owner: "Adnan Sheikh", city: "Islamabad", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Elite", listings: 310, about: "Apartments, offices and houses across Islamabad and Rawalpindi." },
  { name: "Neelum Valley Estates", owner: "Sardar Asif", city: "Muzaffarabad", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Gold", listings: 54, about: "Land, guest houses and hotels in Neelum and Muzaffarabad." },
  { name: "Poonch Property Centre", owner: "Sardar Kamran", city: "Rawalakot", phone: "+92 344 0807888", whatsapp: "923440807888", verified: false, plan: "Basic", listings: 21, about: "Residential and agricultural land in Rawalakot and Banjosa." },
  { name: "Kotli Real Estate", owner: "Mirza Tariq", city: "Kotli", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Gold", listings: 37, about: "Plots and houses in Kotli city and surroundings." },
  { name: "Lahore Home Finders", owner: "Bilal Ahmed", city: "Lahore", phone: "+92 344 0807888", whatsapp: "923440807888", verified: true, plan: "Platinum", listings: 205, about: "DHA, Bahria Town and Gulberg property experts." },
  { name: "Karachi Property Link", owner: "Faraz Khan", city: "Karachi", phone: "+92 344 0807888", whatsapp: "923440807888", verified: false, plan: "Basic", listings: 18, about: "Buying, selling and renting in Gulshan, PECHS and DHA Karachi." }
].map((d, i) => ({ ...d, id: "dealer-" + (i + 1), createdAt: now - i * day }));

export const SERVICE_CATEGORIES = [
  { slug: "maintenance", name: "Maintenance", emoji: "🛠" },
  { slug: "interior-designer", name: "Interior Design", emoji: "🏠" },
  { slug: "contractor", name: "Construction", emoji: "🏗" },
  { slug: "electrician", name: "Electrician", emoji: "⚡" },
  { slug: "plumber", name: "Plumber", emoji: "🚰" },
  { slug: "painter", name: "Painter", emoji: "🎨" },
  { slug: "ac-technician", name: "AC Services", emoji: "❄️" },
  { slug: "cleaning", name: "Cleaning", emoji: "🧹" }
];

export const SEED_SERVICES = [
  { name: "Mirpur Home Repairs", category: "maintenance", city: "Mirpur AJK", experience: 12, rating: 4.8, verified: true, about: "Complete home maintenance — masonry, carpentry, waterproofing." },
  { name: "Elegant Interiors AJK", category: "interior-designer", city: "Mirpur AJK", experience: 9, rating: 4.9, verified: true, about: "Modern interior design, false ceilings, wardrobes and kitchens." },
  { name: "Raja Builders & Contractors", category: "contractor", city: "Mirpur AJK", experience: 18, rating: 4.7, verified: true, about: "Grey structure and turnkey construction with complete material." },
  { name: "Bright Spark Electric", category: "electrician", city: "Muzaffarabad", experience: 7, rating: 4.6, verified: true, about: "House wiring, solar installation, UPS and generator connection." },
  { name: "Quick Fix Plumbing", category: "plumber", city: "Mirpur AJK", experience: 10, rating: 4.5, verified: false, about: "Leak repair, bathroom fitting, water tank and motor installation." },
  { name: "Colour House Painters", category: "painter", city: "Kotli", experience: 8, rating: 4.4, verified: true, about: "Interior & exterior paint, texture and wallpaper work." },
  { name: "Cool Air AC Services", category: "ac-technician", city: "Mirpur AJK", experience: 6, rating: 4.7, verified: true, about: "AC installation, gas refill, service and inverter repair." },
  { name: "Sparkle Cleaning Co.", category: "cleaning", city: "Islamabad", experience: 5, rating: 4.6, verified: true, about: "Deep cleaning, sofa & carpet shampoo, water tank cleaning." },
  { name: "Kashmir Construction Co.", category: "contractor", city: "Rawalakot", experience: 15, rating: 4.8, verified: true, about: "Houses, guest houses and commercial buildings in Poonch division." },
  { name: "Pro Electric Works", category: "electrician", city: "Mirpur AJK", experience: 11, rating: 4.5, verified: false, about: "Industrial and domestic electrical work, 3-phase connections." }
].map((s, i) => ({ ...s, id: "svc-" + (i + 1), phone: "+92 344 0807888", whatsapp: "923440807888", createdAt: now - i * day }));

export const PACKAGES = [
  { name: "Basic", price: 0, per: "Free forever", ads: 1, features: ["1 active property ad", "30 days ad validity", "WhatsApp & call leads", "Basic support"] },
  { name: "Gold", price: 5000, per: "per month", ads: 10, features: ["10 active property ads", "1 featured ad", "Dealer profile page", "Verified dealer badge", "Email support"] },
  { name: "Platinum", price: 15000, per: "per month", ads: 100, popular: true, features: ["100 active property ads", "15 featured ads", "Priority listing placement", "Verified dealer badge", "Leads dashboard", "Phone support"] },
  { name: "Elite", price: 35000, per: "per month", ads: 250, features: ["250 active property ads", "40 featured ads", "Top of search results", "Verified dealer badge", "Dedicated account manager", "Social media promotion"] }
];

export const CITIES = {
  "Azad Kashmir": ["Mirpur AJK", "Muzaffarabad", "Rawalakot", "Kotli", "Bhimber", "Neelum Valley", "Hattian Bala", "Bagh", "Pallandri", "Haveli"],
  "Pakistan": ["Islamabad", "Rawalpindi", "Lahore", "Karachi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Hyderabad", "Sialkot", "Gujranwala", "Bahawalpur"]
};
export const AJK_CITIES = CITIES["Azad Kashmir"];

export const TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "farm", label: "Farm House" },
  { value: "building", label: "Building" }
];
export const COMMERCIAL_TYPES = ["commercial", "shop", "office", "warehouse", "building"];
