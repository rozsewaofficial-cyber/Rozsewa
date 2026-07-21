const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Service = require('../models/Service');

const sampleHierarchy = [
    {
        categoryMatch: /ac|appliance/i,
        subcategories: [
            { name: "AC Servicing & Jet Cleaning", icon: "Wrench", desc: "Deep cleaning with high-pressure foam jet", price: 399, duration: "45 min" },
            { name: "AC Gas Leakage & Refill", icon: "Zap", desc: "Leak test & full refrigerant gas top-up", price: 1499, duration: "1 hr" },
            { name: "AC Repair & Diagnosis", icon: "Wrench", desc: "PCB fix, compressor repair, fan replacement", price: 299, duration: "1 hr" },
            { name: "AC Mounting & Unmounting", icon: "Home", desc: "Split/Window AC safe installation and removal", price: 799, duration: "1.5 hrs" },
            { name: "Refrigerator Servicing", icon: "Sparkles", desc: "Single/Double door cooling repair and gas refill", price: 499, duration: "1 hr" },
            { name: "Washing Machine Fix", icon: "Wrench", desc: "Front/Top load drum repair & pump replacement", price: 349, duration: "45 min" },
            { name: "Microwave Oven Repair", icon: "Zap", desc: "Magnetron, glass turntable, heating element fix", price: 399, duration: "30 min" },
            { name: "RO Water Purifier Service", icon: "Droplets", desc: "Complete filter replacement & TDS calibration", price: 499, duration: "45 min" },
            { name: "Geyser & Heater Repair", icon: "Zap", desc: "Thermostat, element fitting & leak seal", price: 349, duration: "45 min" },
            { name: "TV & Soundbar Mounting", icon: "Tv", desc: "Wall mounting, wiring concealment & setup", price: 249, duration: "30 min" }
        ]
    },
    {
        categoryMatch: /electrician/i,
        subcategories: [
            { name: "Switches & Socket Repair", icon: "Zap", desc: "Replace burnt switches, modular board fitting", price: 149, duration: "20 min" },
            { name: "Ceiling & Exhaust Fans", icon: "Zap", desc: "Fan mounting, regulator fix, motor servicing", price: 249, duration: "30 min" },
            { name: "Lights & Chandelier Setup", icon: "Sparkles", desc: "LED panel, strip lights, heavy chandelier hanging", price: 299, duration: "45 min" },
            { name: "Wiring & Short Circuit Fix", icon: "Zap", desc: "MCB tripping resolution & new heavy load wiring", price: 399, duration: "1 hr" },
            { name: "Inverter & Battery Wiring", icon: "Zap", desc: "Inverter installation, terminal cleaning & backup setup", price: 499, duration: "1 hr" },
            { name: "Doorbell & Smart Camera", icon: "Bell", desc: "Wireless bell, smart video doorbell mounting", price: 199, duration: "30 min" },
            { name: "Main DB Box & Changeover", icon: "Zap", desc: "Sub-meter fitting, main switch replacement", price: 599, duration: "1.5 hrs" },
            { name: "Appliance Power Points", icon: "Zap", desc: "16A AC/Geyser socket installation with earthing", price: 249, duration: "30 min" },
            { name: "Whole House Safety Audit", icon: "Shield", desc: "Earthing check, voltage test, surge protection", price: 699, duration: "2 hrs" },
            { name: "Commercial Shop Wiring", icon: "Briefcase", desc: "Ducting, spotlight setup, emergency backup line", price: 999, duration: "3 hrs" }
        ]
    },
    {
        categoryMatch: /plumber/i,
        subcategories: [
            { name: "Tap & Mixer Repair", icon: "Droplets", desc: "Fix leaky taps, spindle replacement, sink mixer fix", price: 149, duration: "25 min" },
            { name: "Toilet & Commode Fitting", icon: "Droplets", desc: "Flush tank mechanism, seat cover, jet spray fix", price: 299, duration: "45 min" },
            { name: "Blocked Drain Unclogging", icon: "Droplets", desc: "Drainage unclogging using spring snake tool", price: 349, duration: "45 min" },
            { name: "Water Tank Deep Clean", icon: "Sparkles", desc: "Overhead 500-1000L tank sludge removal", price: 499, duration: "1.5 hrs" },
            { name: "Washbasin & Sink Coupling", icon: "Droplets", desc: "Waste pipe fitting, bottle trap replacement", price: 199, duration: "30 min" },
            { name: "Shower & Valve Repair", icon: "Droplets", desc: "Rain shower installation, diverter valve fix", price: 299, duration: "40 min" },
            { name: "Water Booster Pump", icon: "Wrench", desc: "Pressure pump installation & auto-controller setup", price: 799, duration: "2 hrs" },
            { name: "Pipe Leakage Detection", icon: "Droplets", desc: "Concealed pipe leak repair & joint sealing", price: 399, duration: "1 hr" },
            { name: "Water Motor Servicing", icon: "Wrench", desc: "Monoblock motor fitting & capacitor replacement", price: 349, duration: "45 min" },
            { name: "CP Bath Accessories", icon: "Home", desc: "Towel rod, soap dispenser, mirror bracket drilling", price: 199, duration: "30 min" }
        ]
    },
    {
        categoryMatch: /salon|grooming/i,
        subcategories: [
            { name: "Styling & Haircuts", icon: "Scissors", desc: "Men/Women trendy haircut, hair wash & blowout", price: 199, duration: "30 min" },
            { name: "Beard Grooming & Shave", icon: "Scissors", desc: "Beard shaping, razor styling & charcoal post-shave", price: 129, duration: "20 min" },
            { name: "Facials & Skin Cleanups", icon: "Sparkles", desc: "O3+ Herbal & Fruit skin brightening cleanups", price: 499, duration: "45 min" },
            { name: "Hair Color & Highlights", icon: "Paintbrush", desc: "L'Oreal global color, root touchup & streaking", price: 699, duration: "1 hr" },
            { name: "Spa Ice Pedicure", icon: "Sparkles", desc: "Exfoliating foot scrub, nail shaping & massage", price: 449, duration: "45 min" },
            { name: "Smooth Waxing Care", icon: "Sparkles", desc: "Rica wax full arms, legs & underarm waxing", price: 399, duration: "45 min" },
            { name: "Keratin & Hair Spa", icon: "Sparkles", desc: "Deep conditioning spa & smoothing hair treatment", price: 899, duration: "1.5 hrs" },
            { name: "HD Engagement Makeup", icon: "Sparkles", desc: "Professional camera-ready glam & saree draping", price: 1999, duration: "2 hrs" },
            { name: "Head & Shoulder Massage", icon: "Heart", desc: "Aromatic oil head massage & stress relief spa", price: 299, duration: "30 min" },
            { name: "De-Tan Body Polish", icon: "Sparkles", desc: "Full back & arm anti-tan scrub with hydration", price: 599, duration: "45 min" }
        ]
    },
    {
        categoryMatch: /pandit|religious/i,
        subcategories: [
            { name: "Griha Pravesh Puja", icon: "BookOpen", desc: "Vedic housewarming, Vastu Havan & Ganesha sthapana", price: 2100, duration: "3 hrs" },
            { name: "Satyanarayan Vrat Katha", icon: "BookOpen", desc: "Complete katha samagri, prasad & aarti rituals", price: 1100, duration: "2 hrs" },
            { name: "Lakshmi Kuber Puja", icon: "BookOpen", desc: "Diwali & office inauguration wealth blessing", price: 1500, duration: "2 hrs" },
            { name: "Maha Mrityunjay Jaap", icon: "BookOpen", desc: "Chanting for health, peace & protection", price: 2500, duration: "4 hrs" },
            { name: "Rudrabhishek Ritual", icon: "BookOpen", desc: "Shiva Panchamrit abhishek & bilvapatra puja", price: 1800, duration: "2.5 hrs" },
            { name: "Marriage Kundali Matching", icon: "BookOpen", desc: "Guna Milan, Dosha analysis & wedding muhurat", price: 500, duration: "45 min" },
            { name: "Namkaran & Annaprashan", icon: "BookOpen", desc: "Baby naming ritual & first solid food ceremony", price: 1100, duration: "1.5 hrs" },
            { name: "Navchandi Havan", icon: "BookOpen", desc: "Durga Saptashati path & Nine Goddess Havan", price: 3100, duration: "4 hrs" },
            { name: "Sundarkand Path", icon: "BookOpen", desc: "Hanuman Chalisa & Sundarkand recitation", price: 1200, duration: "2 hrs" },
            { name: "Vastu Shanti Puja", icon: "BookOpen", desc: "Remedial Vastu puja for home & commercial space", price: 2100, duration: "3 hrs" }
        ]
    },
    {
        categoryMatch: /painter/i,
        subcategories: [
            { name: "Interior Wall Painting", icon: "Paintbrush", desc: "Emulsion washable paint application on walls", price: 12, duration: "1-3 days" },
            { name: "Exterior Weather Shield", icon: "Paintbrush", desc: "Dust & rain repellent exterior coating", price: 15, duration: "2-4 days" },
            { name: "Wall Waterproofing", icon: "Droplets", desc: "Seepage treatment, dampness seal & putty", price: 18, duration: "1-2 days" },
            { name: "Wood & Furniture Polish", icon: "Paintbrush", desc: "PU wood polish for doors, tables & cabinets", price: 799, duration: "1 day" },
            { name: "Designer Wall Textures", icon: "Paintbrush", desc: "Stencil design, metallic & velvet wall textures", price: 25, duration: "1-2 days" },
            { name: "Enamel Metal Painting", icon: "Paintbrush", desc: "Anti-rust gloss paint for iron grills & gates", price: 499, duration: "1 day" },
            { name: "Wallpaper Installation", icon: "Home", desc: "Custom 3D wallpaper fixing & adhesive application", price: 399, duration: "3 hrs" },
            { name: "POP & False Ceiling Fix", icon: "Home", desc: "Ceiling crack repair, plaster of Paris touchup", price: 599, duration: "1 day" },
            { name: "Full Home Painting", icon: "Paintbrush", desc: "Complete 1/2/3 BHK painting with masking", price: 4999, duration: "3-5 days" },
            { name: "Color Consultation", icon: "Sparkles", desc: "Virtual color shade preview & estimate visit", price: 199, duration: "1 hr" }
        ]
    },
    {
        categoryMatch: /cleaning/i,
        subcategories: [
            { name: "Full Home Deep Cleaning", icon: "Sparkles", desc: "Floor scrubbing, balcony, doors & window track clean", price: 1999, duration: "4 hrs" },
            { name: "Kitchen Degreasing", icon: "Sparkles", desc: "Oil stain removal from tiles, cabinets & chimney", price: 799, duration: "2 hrs" },
            { name: "Bathroom Disinfection", icon: "Sparkles", desc: "Limescale removal, hard water stain & tile grout scrub", price: 499, duration: "1.5 hrs" },
            { name: "Sofa & Cushion Shampoo", icon: "Sparkles", desc: "Fabric vacuuming, organic shampoo & wet extraction", price: 599, duration: "1.5 hrs" },
            { name: "Pest Control Herbal", icon: "Shield", desc: "Cockroach gel treatment, ant & termite extermination", price: 899, duration: "2 hrs" },
            { name: "Carpet & Rug Deep Scrub", icon: "Sparkles", desc: "Stain removal, hot water extraction for rugs", price: 399, duration: "1 hr" },
            { name: "Mattress Sanitization", icon: "Sparkles", desc: "Dust mite removal, steam cleaning for beds", price: 499, duration: "1 hr" },
            { name: "Balcony & Window Cleaning", icon: "Sparkles", desc: "Glass pane wiping, rail rust removal & pressure wash", price: 349, duration: "1 hr" },
            { name: "Move-In / Move-Out Clean", icon: "Sparkles", desc: "Vacant home deep cleaning & cabinet wiping", price: 2499, duration: "5 hrs" },
            { name: "Office Desk Disinfection", icon: "Briefcase", desc: "Sanitization of keyboards, chairs & glass partitions", price: 1499, duration: "3 hrs" }
        ]
    }
];

async function seed() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/rozsewa';
        console.log(`Connecting to MongoDB...`);
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        const categories = await Category.find({});
        console.log(`Found ${categories.length} categories in Database.`);

        for (const cat of categories) {
            console.log(`\nProcessing Category: "${cat.name}" (_id: ${cat._id})`);
            
            // Find sample subcategories matching this category name
            let matchObj = sampleHierarchy.find(s => s.categoryMatch.test(cat.name));

            let subList = matchObj ? matchObj.subcategories : [
                { name: `${cat.name} General Repair`, icon: "Wrench", desc: `Expert ${cat.name} repair at your doorstep`, price: 199, duration: "30 min" },
                { name: `${cat.name} Installation`, icon: "Home", desc: `New ${cat.name} fitting & mounting service`, price: 399, duration: "1 hr" },
                { name: `${cat.name} Maintenance`, icon: "Sparkles", desc: `Periodic inspection & servicing for ${cat.name}`, price: 299, duration: "45 min" },
                { name: `${cat.name} Deep Clean`, icon: "Sparkles", desc: `Deep sanitization and cleaning for ${cat.name}`, price: 499, duration: "1 hr" },
                { name: `${cat.name} Inspection`, icon: "Shield", desc: `Safety check & problem diagnosis`, price: 149, duration: "20 min" },
                { name: `${cat.name} Emergency Fix`, icon: "Zap", desc: `Urgent fast-track service response`, price: 499, duration: "30 min" },
                { name: `${cat.name} Uninstallation`, icon: "Trash2", desc: `Safe unmounting and removal`, price: 249, duration: "45 min" },
                { name: `${cat.name} Replacement Part`, icon: "Wrench", desc: `Part replacement & fitting`, price: 349, duration: "45 min" },
                { name: `${cat.name} Premium Package`, icon: "Sparkles", desc: `Full end-to-end service package`, price: 999, duration: "2 hrs" },
                { name: `${cat.name} Commercial Service`, icon: "Briefcase", desc: `Bulk office/shop service setup`, price: 1499, duration: "3 hrs" }
            ];

            let index = 1;
            for (const subItem of subList) {
                // Upsert Subcategory
                let subDoc = await Subcategory.findOne({ categoryId: cat._id, name: subItem.name });
                if (!subDoc) {
                    subDoc = await Subcategory.create({
                        name: subItem.name,
                        categoryId: cat._id,
                        description: subItem.desc,
                        icon: subItem.icon || "Wrench",
                        isActive: true,
                        index: index++
                    });
                    console.log(`  + Created Subcategory: "${subDoc.name}"`);
                } else {
                    console.log(`  = Subcategory already exists: "${subDoc.name}"`);
                }

                // Upsert Service under this Subcategory
                let serviceDoc = await Service.findOne({ subcategoryId: subDoc._id, name: `${subItem.name} Standard` });
                if (!serviceDoc) {
                    await Service.create({
                        name: `${subItem.name} Standard`,
                        description: subItem.desc,
                        price: subItem.price,
                        duration: subItem.duration,
                        visible: true,
                        subcategoryId: subDoc._id,
                        subcategory: subDoc.name,
                        categoryId: cat._id,
                        category: cat.name
                    });
                    console.log(`    + Created Service: "${subItem.name} Standard" (₹${subItem.price})`);
                }
            }
        }

        console.log('\n✅ Successfully seeded subcategories and services!');
        process.exit(0);
    } catch (err) {
        console.error('Error during seeding:', err);
        process.exit(1);
    }
}

seed();
