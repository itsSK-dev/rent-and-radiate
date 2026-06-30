// Comprehensive list of Indian cities, towns and notable villages used by the
// location picker autocomplete. Bihar (and especially Seemanchal around Purnea)
// is covered exhaustively; the rest of India lists every state capital and
// every Tier‑1/Tier‑2 city plus many Tier‑3 towns. Free‑text input is still
// allowed for anything not in this list.

export const INDIA_CITIES: string[] = [
  // ---- Bihar (full coverage: districts, towns, large villages) ----
  "Purnea", "Purnia", "Katihar", "Araria", "Kishanganj", "Forbesganj", "Jogbani",
  "Banmankhi", "Dhamdaha", "Baisi", "Kasba", "Krityanand Nagar", "Rupauli",
  "Bhawanipur", "Barhara Kothi", "Amour", "Baisa", "Jalalgarh", "Srinagar",
  "Saharsa", "Madhepura", "Supaul", "Birpur", "Nirmali", "Triveniganj",
  "Bhagalpur", "Naugachhia", "Sultanganj", "Kahalgaon", "Banka", "Munger",
  "Khagaria", "Begusarai", "Lakhisarai", "Sheikhpura", "Jamui", "Jhajha",
  "Patna", "Danapur", "Phulwari Sharif", "Bihta", "Fatuha", "Barh", "Mokama",
  "Hajipur", "Vaishali", "Muzaffarpur", "Sitamarhi", "Sheohar", "Motihari",
  "Bettiah", "Bagaha", "Raxaul", "Narkatiaganj", "Gopalganj", "Siwan",
  "Chhapra", "Saran", "Maharajganj", "Mashrakh",
  "Darbhanga", "Madhubani", "Jhanjharpur", "Benipatti", "Jaynagar",
  "Samastipur", "Rosera", "Dalsinghsarai", "Tajpur",
  "Gaya", "Bodh Gaya", "Sherghati", "Tikari", "Nawada", "Rajgir", "Nalanda",
  "Bihar Sharif", "Hilsa", "Aurangabad (Bihar)", "Daudnagar", "Rafiganj",
  "Sasaram", "Dehri", "Bhabua", "Kaimur", "Buxar", "Dumraon",
  "Ara", "Arrah", "Jagdishpur", "Piro", "Jehanabad", "Arwal",

  // ---- Jharkhand (often grouped with Bihar by users) ----
  "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh",
  "Giridih", "Ramgarh", "Phusro", "Medininagar", "Chaibasa", "Sahibganj",
  "Pakur", "Dumka", "Godda", "Jamtara", "Chatra", "Latehar", "Simdega",
  "Khunti", "Lohardaga",

  // ---- West Bengal (border + metros) ----
  "Kolkata", "Howrah", "Siliguri", "Darjeeling", "Kalimpong", "Jalpaiguri",
  "Cooch Behar", "Alipurduar", "Malda", "Raiganj", "Balurghat", "Berhampore",
  "Krishnanagar", "Bardhaman", "Asansol", "Durgapur", "Bankura", "Purulia",
  "Kharagpur", "Midnapore", "Haldia", "Bidhannagar", "Barasat", "Barrackpore",

  // ---- Delhi NCR & North ----
  "Delhi", "New Delhi", "Noida", "Greater Noida", "Ghaziabad", "Faridabad",
  "Gurugram", "Gurgaon", "Sonipat", "Panipat", "Karnal", "Kurukshetra",
  "Ambala", "Hisar", "Rohtak", "Rewari", "Bahadurgarh", "Jhajjar",
  "Chandigarh", "Mohali", "Panchkula", "Ludhiana", "Amritsar", "Jalandhar",
  "Patiala", "Bathinda", "Pathankot", "Hoshiarpur", "Moga", "Firozpur",
  "Shimla", "Manali", "Dharamshala", "Solan", "Mandi", "Kullu", "Una",
  "Bilaspur (HP)", "Kangra", "Hamirpur (HP)", "Chamba", "Sirmaur",
  "Jammu", "Srinagar (J&K)", "Anantnag", "Baramulla", "Udhampur", "Kathua",
  "Leh", "Kargil",

  // ---- Uttar Pradesh ----
  "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Allahabad", "Meerut",
  "Aligarh", "Bareilly", "Moradabad", "Saharanpur", "Muzaffarnagar",
  "Gorakhpur", "Ayodhya", "Faizabad", "Sultanpur", "Jaunpur", "Mirzapur",
  "Mathura", "Vrindavan", "Firozabad", "Etawah", "Mainpuri", "Hathras",
  "Rampur", "Shahjahanpur", "Sitapur", "Hardoi", "Unnao", "Raebareli",
  "Pratapgarh", "Basti", "Deoria", "Kushinagar", "Maharajganj (UP)",
  "Ballia", "Ghazipur", "Azamgarh", "Mau", "Bahraich", "Gonda", "Barabanki",

  // ---- Uttarakhand ----
  "Dehradun", "Haridwar", "Rishikesh", "Roorkee", "Haldwani", "Nainital",
  "Mussoorie", "Almora", "Ranikhet", "Pithoragarh", "Pauri", "Tehri",
  "Kashipur", "Rudrapur",

  // ---- Rajasthan ----
  "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar",
  "Bharatpur", "Sikar", "Pali", "Tonk", "Sri Ganganagar", "Hanumangarh",
  "Bhilwara", "Chittorgarh", "Mount Abu", "Pushkar", "Nagaur", "Churu",
  "Jhunjhunu", "Banswara", "Dungarpur", "Sawai Madhopur",

  // ---- Gujarat ----
  "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
  "Gandhinagar", "Junagadh", "Anand", "Nadiad", "Mehsana", "Bharuch",
  "Navsari", "Valsad", "Vapi", "Porbandar", "Dwarka", "Somnath", "Kutch",
  "Bhuj", "Gandhidham", "Morbi", "Patan",

  // ---- Maharashtra ----
  "Mumbai", "Navi Mumbai", "Thane", "Pune", "Pimpri-Chinchwad", "Nagpur",
  "Nashik", "Aurangabad", "Chhatrapati Sambhajinagar", "Solapur", "Kolhapur",
  "Sangli", "Satara", "Ahmednagar", "Jalgaon", "Akola", "Amravati",
  "Chandrapur", "Latur", "Nanded", "Parbhani", "Beed", "Ratnagiri", "Sindhudurg",
  "Alibag", "Lonavala", "Panvel",

  // ---- Goa ----
  "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda",

  // ---- Madhya Pradesh & Chhattisgarh ----
  "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas",
  "Satna", "Rewa", "Ratlam", "Khandwa", "Khargone", "Singrauli", "Chhindwara",
  "Vidisha", "Hoshangabad", "Narmadapuram", "Burhanpur", "Mandsaur",
  "Raipur", "Bilaspur", "Bhilai", "Durg", "Korba", "Raigarh", "Jagdalpur",
  "Ambikapur", "Rajnandgaon",

  // ---- South India ----
  "Bengaluru", "Bangalore", "Mysuru", "Mysore", "Mangaluru", "Mangalore",
  "Hubballi", "Hubli", "Dharwad", "Belagavi", "Belgaum", "Davangere",
  "Tumakuru", "Tumkur", "Shivamogga", "Shimoga", "Udupi", "Hassan",
  "Vijayapura", "Bijapur", "Kalaburagi", "Gulbarga", "Ballari", "Bellary",
  "Raichur", "Bidar", "Chitradurga", "Kolar", "Chikkamagaluru", "Coorg",
  "Madikeri",
  "Hyderabad", "Secunderabad", "Warangal", "Khammam", "Karimnagar",
  "Nizamabad", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet",
  "Visakhapatnam", "Vizag", "Vijayawada", "Guntur", "Tirupati", "Nellore",
  "Kakinada", "Rajahmundry", "Kurnool", "Anantapur", "Kadapa", "Chittoor",
  "Eluru", "Ongole", "Srikakulam",
  "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Trichy", "Salem",
  "Tirunelveli", "Erode", "Tiruppur", "Vellore", "Thoothukudi", "Tuticorin",
  "Dindigul", "Thanjavur", "Kanchipuram", "Kanyakumari", "Hosur", "Karur",
  "Sivakasi", "Nagercoil", "Cuddalore", "Pondicherry", "Puducherry",
  "Thiruvananthapuram", "Trivandrum", "Kochi", "Cochin", "Ernakulam",
  "Kozhikode", "Calicut", "Thrissur", "Kollam", "Alappuzha", "Kannur",
  "Palakkad", "Malappuram", "Kottayam", "Pathanamthitta", "Idukki",
  "Wayanad", "Kasaragod", "Munnar", "Varkala",

  // ---- Odisha ----
  "Bhubaneswar", "Cuttack", "Puri", "Rourkela", "Sambalpur", "Berhampur",
  "Balasore", "Brahmapur", "Jharsuguda", "Angul", "Dhenkanal", "Koraput",
  "Jeypore",

  // ---- North-East ----
  "Guwahati", "Dispur", "Dibrugarh", "Jorhat", "Silchar", "Tezpur", "Nagaon",
  "Tinsukia", "Bongaigaon", "Barpeta",
  "Shillong", "Tura", "Jowai",
  "Imphal", "Thoubal",
  "Aizawl", "Lunglei",
  "Kohima", "Dimapur", "Mokokchung",
  "Itanagar", "Naharlagun", "Tawang",
  "Agartala", "Udaipur (Tripura)", "Dharmanagar",
  "Gangtok", "Namchi", "Pelling",

  // ---- Andaman & Lakshadweep ----
  "Port Blair", "Kavaratti",
];

// De-dupe while preserving insertion order (some aliases overlap).
const _seen = new Set<string>();
export const INDIA_CITIES_UNIQUE = INDIA_CITIES.filter((c) => {
  const k = c.toLowerCase();
  if (_seen.has(k)) return false;
  _seen.add(k);
  return true;
});
