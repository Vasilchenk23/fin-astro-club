const { google } = require('googleapis');
const { Markup } = require('telegraf');
const { Telegraf } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const cron = require('node-cron');

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
    'Привіт! 👋 Оберіть дію зі списку нижче:',
    Markup.keyboard([['Додати клієнта 📝', 'Продовжити абонемент 🔄', 'Відвідування 🚶']])
      .resize()
      .oneTime()
  );

  ctx.reply(
    `🔔 *Пам'ятка для заповнення інформації:*
    1. Використовуйте тільки українську мову.
    2. Пишіть перше слово у верхньому регістрі (великою літерою).
    3. Переконайтесь, що всі дані введені без помилок.
    4. Дотримуйтесь формату дати: ДД.ММ.РРРР.
    5. Номер телефону: тільки цифри, без пробілів та символів.
    6. Ім'я прізвище та побатьковi: повністю, без скорочень.

    Якщо у вас виникнуть питання, звертайтесь до адміністратора. Гарного дня! 😊`,
    { parse_mode: 'Markdown' }
  );

  currentStep = null; 
});

async function checkBirthdays() {
  const rows = await getSheetData('Лист1!A2:I52');
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  rows.forEach(row => {
    const dob = row[6]; 
    const fullName = row[4]; 

    if (dob) {
      const [day, month] = dob.split('.').map(Number);
      if (day === todayDay && month === todayMonth) {
        bot.telegram.sendMessage(chatId, `🎂 Сьогодні день народження у ${fullName}! 🎉`);
      }
    }
  });
}


bot.hears('Додати клієнта 📝', (ctx) => {
  ctx.reply('Введи номер картки (наприклад, #0016):');
  currentStep = 'card_number'; 
});

bot.hears('Продовжити абонемент 🔄', (ctx) => {
  ctx.reply('Введи номер картки для продовження абонементу:');
  currentStep = 'renew_card';
});

bot.hears('Відвідування 🚶', (ctx) => {
  ctx.reply('Введи номер картки (наприклад, #0016):');
  currentStep = 'increment_visits'; 
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  if (currentStep === 'card_number') {
    userData.cardNumber = text;

    const rowIndex = await checkAndFillCard(userData.cardNumber);

    if (rowIndex === -1) {
      ctx.reply(`❌ Карта з номером ${userData.cardNumber} не знайдено. Спробуй інший номер.`);
    } else if (rowIndex === null) {
      ctx.reply(`⚠️ Карта з номером ${userData.cardNumber} вже заповнена. Спробуй інший номер.`);
    } else {
      userData.rowIndex = rowIndex; 
      ctx.reply('✅ Карта знайдена! 🎉 Введи колір картки (наприклад, синя картка або червона картка):');
      currentStep = 'color';
    }
  } else if (currentStep === 'color') {
    userData.color = text;
    ctx.reply('📅 Введи дату покупки (наприклад, 12.09.2024):');
    currentStep = 'purchase_date';
  } else if (currentStep === 'purchase_date') {
    userData.purchaseDate = text;
    ctx.reply('💵 Введи вартість:');
    currentStep = 'price';
  } else if (currentStep === 'price') {
    userData.price = text;
    ctx.reply('✍️ Введи ПІБ:');
    currentStep = 'fio';
  } else if (currentStep === 'fio') {
    userData.fio = text;
    ctx.reply('📞 Введи номер телефону:');
    currentStep = 'phone';
  } else if (currentStep === 'phone') {
    userData.phone = text;
    ctx.reply('🎂 Введи дату народження (наприклад, 23.10.2007):');  
    currentStep = 'dob'; 
  } else if (currentStep === 'dob') { 
    userData.dob = text;
    ctx.reply('🗓 Введи кількість заходів (наприклад, 4):');
    currentStep = 'events';
  } else if (currentStep === 'events') {
    userData.events = text;
    ctx.reply('🚶 Введи кількість відвідувань (наприклад, 1):');
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

      ctx.reply('✅ Дані успішно збережені! 🎉');
      currentStep = null;
      userData = {}; 
    } else {
      ctx.reply('❌ Помилка: rowIndex не знайдено.');
    }
  }
  
  if (currentStep === 'increment_visits') {
    const cardNumber = text;

    const rows = await getSheetData('Лист1!A2:I52');
    const cardRow = rows.findIndex(row => row[1] === cardNumber);

    if (cardRow !== -1) {
        const rowIndex = cardRow + 2; 
        let currentVisits = parseInt(rows[cardRow][8], 10);
        let totalEvents = parseInt(rows[cardRow][7], 10); 
        let remainingEvents = totalEvents - currentVisits; 

        if (remainingEvents > 0) { 
            currentVisits++; 

            await updateSheetData(`Лист1!H${rowIndex}:J${rowIndex}`, [
                [totalEvents, currentVisits, totalEvents - currentVisits],
            ]);

            ctx.reply(`✅ Відвідування додано! Тепер у карти ${cardNumber} ${currentVisits} відвідувань. Залишилося заходів: ${totalEvents - currentVisits}.`);
        } else {
            ctx.reply(`⚠️ Усі заходи для картки ${cardNumber} вже відвідані. Залишилось заходів: 0.`);
        }
    } else {
        ctx.reply(`❌ Карта з номером ${cardNumber} не знайдена.`);
    }

    currentStep = null; 
}

  else if (currentStep === 'renew_card') {
    const cardNumber = text;

    const rows = await getSheetData('Лист1!A2:J52');
    const cardRow = rows.findIndex(row => row[1] === cardNumber);

    if (cardRow !== -1) {
      userData.rowIndex = cardRow + 2; 
      ctx.reply('📅 Введи новую дату покупки:');
      currentStep = 'new_purchase_date';
    } else {
      ctx.reply(`❌ Карта з номером ${cardNumber} не знайдена. Спробуй інший номер.`);
      currentStep = null;
    }
  } else if (currentStep === 'new_purchase_date') {
    const newPurchaseDate = text;
    const rowIndex = userData.rowIndex;

    if (rowIndex) {
      const rows = await getSheetData(`Лист1!A${rowIndex}:J${rowIndex}`);
      const events = rows[0][7]; 

      await updateSheetData(`Лист1!C${rowIndex}:J${rowIndex}`, [
        [
          newPurchaseDate,
          rows[0][3],
          rows[0][4],
          rows[0][5], 
          rows[0][6], 
          events, 
          0,
          events 
        ],
      ]);

      ctx.reply('✅ Абонемент успішно продовжено! Кількість відвідувань скинуто на 0. 🎉');
      currentStep = null;
    } else {
      ctx.reply('❌ Помилка: rowIndex не знайдено.');
    }
  }

});

cron.schedule('38 19 * * *', checkBirthdays);

bot.launch();
console.log('Бот запущен');
