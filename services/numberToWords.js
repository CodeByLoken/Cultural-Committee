const marathiWords = [
  '', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
  'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सत्तरा', 'अठरा', 'एकोणीस', 'वीस',
  'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस', 'तीस',
  'एकतीस', 'बत्तीस', 'तेहेतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस', 'चाळीस',
  'एकचाळीस', 'बेचाळीस', 'त्रेशेचाळीस', 'चौचाळीस', 'पंचेचाळीस', 'शेचाळीस', 'सतचाळीस', 'अडचाळीस', 'एकोणपन्नास', 'पन्नास',
  'एक्यावन्न', 'बावन्न', 'त्रेपन्न', 'चौपन्न', 'पन्न्यावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ', 'साठ',
  'एकसष्ट', 'बासष्ट', 'त्रेसष्ट', 'चौसष्ट', 'पासष्ट', 'सहसष्ट', 'सरसष्ट', 'अडसष्ट', 'एकोणसत्तर', 'सत्तर',
  'एकहत्तर', 'बहात्तर', 'त्र्याहत्तर', 'चौऱ्याहत्तर', 'पंचहत्तर', 'शहात्तर', 'सतहत्तर', 'अठ्ठाहत्तर', 'एकोणऐंशी', 'ऐंशी',
  'एक्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौऱ्याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्त्याऐंशी', 'अठ्ठाऐंशी', 'एकोणणव्वद', 'नव्वद',
  'एक्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंच्याण्णव', 'शहाण्णव', 'सत्त्याण्णव', 'अठ्ठाण्णव', 'नव्व्याण्णव'
];

const hindiWords = [
  '', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
  'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
  'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
  'इकतलीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
  'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
  'इक्यावन', 'बावन', 'तिर्पन', 'चौवन', 'पचपन', 'छप्पन्न', 'सत्तावन', 'अट्टावन', 'उनसठ', 'साठ',
  'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सरसठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
  'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
  'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
  'इक्यान्वे', 'बान्वे', 'तिरान्वे', 'चौरान्वे', 'पंचान्वे', 'छियान्वे', 'संतानवे', 'अट्ठानवे', 'निन्यानवे'
];

function convertUnderThousandMR(num) {
  let str = '';
  if (num >= 100) {
    let h = Math.floor(num / 100);
    str += (h === 1 ? 'एकशे' : marathiWords[h] + 'शे') + ' ';
    num %= 100;
  }
  if (num > 0) str += marathiWords[num];
  return str.trim();
}

function numToMarathi(n) {
  if (!n || n <= 0) return '';
  let result = '';
  if (n >= 100000) {
    result += convertUnderThousandMR(Math.floor(n / 100000)) + ' लाख ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += convertUnderThousandMR(Math.floor(n / 1000)) + ' हजार ';
    n %= 1000;
  }
  if (n > 0) result += convertUnderThousandMR(n);
  return result.trim() + ' रुपये फक्त';
}

function convertUnderThousandHI(num) {
  let str = '';
  if (num >= 100) {
    str += hindiWords[Math.floor(num / 100)] + ' सौ ';
    num %= 100;
  }
  if (num > 0) str += hindiWords[num];
  return str.trim();
}

function numToHindi(n) {
  if (!n || n <= 0) return '';
  let result = '';
  if (n >= 100000) {
    result += convertUnderThousandHI(Math.floor(n / 100000)) + ' लाख ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += convertUnderThousandHI(Math.floor(n / 1000)) + ' हजार ';
    n %= 1000;
  }
  if (n > 0) result += convertUnderThousandHI(n);
  return result.trim() + ' रुपये मात्र';
}

function numToEnglish(n) {
  if (!n || n <= 0) return '';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(num) {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + units[num % 10] : '');
    } else if (num > 0) {
      str += units[num];
    }
    return str.trim();
  }

  let result = '';
  if (n >= 100000) {
    result += convert(Math.floor(n / 100000)) + ' Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += convert(Math.floor(n / 1000)) + ' Thousand ';
    n %= 1000;
  }
  if (n > 0) result += convert(n);
  return result.trim() + ' Rupees Only';
}

module.exports = {
  getAmountInWords: (amount, lang) => {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num <= 0) return '';
    if (lang === 'hi') return numToHindi(num);
    if (lang === 'en') return numToEnglish(num);
    return numToMarathi(num);
  }
};
