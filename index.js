const { google } = require('googleapis');
const { Markup } = require('telegraf');
const { Telegraf } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const keys = {
  client_email: process.env.CLIENT_EMAIL,
  private_key: process.env.PRIVATE_KEY,
};


const bot = new Telegraf('7629602871:AAGOYX5eqcVHujr8DFZP-WklZ2XX0RPQItE');


const client = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const spreadsheetId = '1J8gCRcoZoZWx4Wvqjht9nd_o77ogxoYcS03anzt8sKc';


async function getSheetData(range) {
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values;
}


async function updateSheetData(range, values) {
  const sheets = google.sheets({ version: 'v4', auth: client });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource: { values },
  });
}


let userData = {};
let currentStep = null;

async function checkAndFillCard(cardNumber) {
  const rows = await getSheetData('Лист1!A2:I52');
  const cardRow = rows.findIndex(row => row[1] === cardNumber); 

  if (cardRow !== -1) {
    const rowData = rows[cardRow].slice(3);
    const isRowEmpty = rowData.every(cell => !cell); 

    if (isRowEmpty) {
      return cardRow + 2; 
    } else {
      return null;
    }
  } else {
    return -1; 
  }
}


bot.start((ctx) => {
  chatId = ctx.chat.id;
  ctx.reply(
    'Привет! 👋 Выберите действие:',
    Markup.keyboard([['Добавить клиента 📝']]) 
      .resize() 
      .oneTime()
  );
  currentStep = null; 
});


bot.hears('Добавить клиента 📝', (ctx) => {
  ctx.reply('Введи номер карты (например, #0016):');
  currentStep = 'card_number'; 
});


bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  if (currentStep === 'card_number') {
    userData.cardNumber = text;

    const rowIndex = await checkAndFillCard(userData.cardNumber);

    if (rowIndex === -1) {
      ctx.reply(`❌ Карта с номером ${userData.cardNumber} не найдена. Попробуй другой номер.`);
    } else if (rowIndex === null) {
      ctx.reply(`⚠️ Карта с номером ${userData.cardNumber} уже заполнена. Попробуй другой номер.`);
    } else {
      userData.rowIndex = rowIndex; 
      ctx.reply('✅ Карта найдена! 🎉 Введи цвет карты:');
      currentStep = 'color';
    }
  } else if (currentStep === 'color') {
    userData.color = text;
    ctx.reply('📅 Введи дату покупки (например, 12.09.2024):');
    currentStep = 'purchase_date';
  } else if (currentStep === 'purchase_date') {
    userData.purchaseDate = text;
    ctx.reply('💵 Введи стоимость:');
    currentStep = 'price';
  } else if (currentStep === 'price') {
    userData.price = text;
    ctx.reply('✍️ Введи ФИО:');
    currentStep = 'fio';
  } else if (currentStep === 'fio') {
    userData.fio = text;
    ctx.reply('📞 Введи номер телефона:');
    currentStep = 'phone';
  } else if (currentStep === 'phone') {
    userData.phone = text;
    ctx.reply('🎂 Введи дату рождения (например, 23.10.2007):');  
    currentStep = 'dob'; 
  } else if (currentStep === 'dob') { 
    userData.dob = text;
    ctx.reply('🗓 Введи количество мероприятий (например, 4):');
    currentStep = 'events';
  } else if (currentStep === 'events') {
    userData.events = text;
    ctx.reply('🚶 Введи количество посещений (например, 0):');
    currentStep = 'visits';
  } else if (currentStep === 'visits') {
    userData.visits = text;

    const rowIndex = userData.rowIndex;

    if (rowIndex) {
      await updateSheetData(`Лист1!A${rowIndex}:J${rowIndex}`, [
        [
          userData.color,
          userData.cardNumber,
          userData.purchaseDate,
          userData.price,
          userData.fio,
          userData.phone,
          userData.dob,  
          userData.events,
          userData.visits,
          userData.events - userData.visits 
        ],
      ]);

      ctx.reply('✅ Данные успешно сохранены! 🎉');
      currentStep = null;
      userData = {}; 
    } else {
      ctx.reply('❌ Ошибка: rowIndex не найден.');
    }
  }
});

bot.launch();
console.log('Бот запущен');
