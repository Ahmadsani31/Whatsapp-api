const phoneNumberFormatter = function(number){
// menghilangkan karakter selain angka / 089-9654-654

let formatted = number.replace(/\D/g,'');
//menghilangkan angka 0 di depan  (prefix), kemudia di ganti dengan 62

if (formatted.startsWith('0')) {
formatted = '62'+formatted.substr(1);
}
if (!formatted.endsWith('@c.us')) {
    formatted +='@c.us';
}
return formatted;
}

module.exports = {
    phoneNumberFormatter
}