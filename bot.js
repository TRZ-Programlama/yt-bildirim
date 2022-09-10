const { Client, MessageEmbed, Collection } = require('discord.js')
const client = new Client({intents:519});
const fs = require('fs')
const path = require('path');
const db = require("nrc.db");
const config = require("./config.js")

client.files = fs.readdirSync;

const { token, prefix } = require('./config.js')

  //yt bildirim 
  var parseXml = require("xml2js").parseString;
var pubSubHubbub = require("pubsubhubbub");
var request = require("request").defaults({
  headers: {
    "User-Agent": config.ua || "ytdsc"
  }
});

if (!config.callback) {
  console.error(
    "Lütfen CALLBACK urlsi giriniz (Projenizin website urlsini yazmanız gereklidir)"
  );
  process.exit(1);
}

var channelId = config.ytid || "YouTube Kanal ID";
var topic =
  "https://www.youtube.com/xml/feeds/videos.xml?channel_id=" + channelId;
var hub = "https://pubsubhubbub.appspot.com/";

var lastId = "";
var isExiting = false;

var pubSubSubscriber = pubSubHubbub.createServer({
  callbackUrl: config.callback
});

pubSubSubscriber.on("denied", function() {
  console.error("DENIED", JSON.stringify(arguments));
  process.exit(2);
});

pubSubSubscriber.on("error", function() {
  console.error("ERROR", JSON.stringify(arguments));
  process.exit(3);
});

setInterval(function() {
  pubSubSubscriber.subscribe(topic, hub, function(err) {
    if (err) console.error(err);
  });
}, 8600); // refresh subscription every 24 hours

pubSubSubscriber.on("listen", function() {
  console.log("Kanalınıza Bakılıyor");
  // log successful subscriptions
  pubSubSubscriber.on("abone", function(data) {
    console.log(
      data.topic +
        " kadar abone oldum " +
        new Date(data.lease * 1000).toLocaleString()
    );
  });
  // resubscribe, if unsubscribed while running
  pubSubSubscriber.on("abonelikten çıkan", function(data) {
    console.log(data.topic + " abonelikten çıkmak");
    if (!isExiting) {
      pubSubSubscriber.subscribe(topic, hub, function(err) {
        if (err) console.error(err);
      });
    }
  });
  // Subscribe on start
  pubSubSubscriber.subscribe(topic, hub, function(err) {
    if (err) console.error(err);
  });
  // Parse responses
  pubSubSubscriber.on("feed", function(data) {
    var feedstr = data.feed.toString("utf8");
    parseXml(feedstr, function(err, feed) {
      if (err) {
        console.error("ERROR", err);
      }
      console.log("JSON:", JSON.stringify(feed.feed));
      if (feed.feed.entry) {
        feed.feed.entry.forEach(postToHook);
      } else console.log("Yeni Video");
    });
  });
});

pubSubSubscriber.listen(config.port || 8000);

function postToHook(entry) {
  console.log("Son", lastId, "Şuanki", entry["yt:videoId"][0]);
  // Ensure it's a video upload and not a duplicate entry
  if (
    entry["published"] &&
    entry["yt:channelId"] == channelId &&
    lastId != entry["yt:videoId"][0] &&
    new Date(entry["updated"]).getTime() -
      new Date(entry["published"]).getTime() <
      60 * 60 * 1000 // 5 min
  ) {
    lastId = entry["yt:videoId"][0];
    console.log("newlast", lastId);
    request.post(
      {
        url: config.webhookurl,
        form: {
          content:
            "Yeni Video Yüklendi @everyone: " +
            entry["title"] +
            " - https://youtu.be/" +
            entry["yt:videoId"][0],
          embeds: [
            {
              video: "https://youtu.be/" + entry["yt:videoId"][0]
            }
          ]
        }
      },
      function(err, response, body) {
        if (err) {
          console.log("error:", err);
        }
        if (response) {
          console.log("status:", response.statusCode);
        }
        if (body) {
          console.log("body:", body);
        }
      }
    );
  }
}
  //#endregion
client.login(process.env.token).then(() => console.log(`${client.user.tag} Giriş Başarılı`)).catch(e => {
    console.log(e)
    console.log(`${client.user.tag} Giriş Başarısız`)
    process.exit(1)
})