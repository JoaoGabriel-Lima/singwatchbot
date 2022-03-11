import clientPromise from "./lib/mongodb.js";
// import "dotenv/config";
import { Client, Intents } from "discord.js";
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
});
let db;

let channelIDinfo = undefined;
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  const clientdb = await clientPromise;
  db = clientdb.db(process.env.MONGO_DB);

  db.collection("discord").updateMany({}, { $set: { "channels.0.users": [] } });
  // update every channel array in all documents in the database
});

//verify if someone sent a message starting with the prefix sw! and if the command is named set, if so, it will verify if the user has sent a text after the command
client.on("messageCreate", async (ctx) => {
  if (ctx.author.bot) return;
  if (ctx.content.startsWith("sw!")) {
    if (ctx.content.startsWith("sw!set")) {
      // verify if the user has sent a name after the command sw!set
      if (ctx.content.split(" ").length > 1) {
        channelIDinfo = ctx.content.split(" ")[1];

        //verify if the channelId is a valid channelId
        if (ctx.guild.channels.cache.has(channelIDinfo)) {
          //verify if the channelId is a text channel
          if (
            ctx.guild.channels.cache.get(channelIDinfo).type === "GUILD_VOICE"
          ) {
            client.channels.fetch(channelIDinfo).then((channel) => {
              if (channel) {
                let dataToInit = {
                  channel: channel.name,
                  channelId: channel.id,
                  users: channel.members.map((member) => member.user.id),
                  isMusicBotPlaying: channel.members
                    .map((member) => member.user.id)
                    .includes("547905866255433758"),
                };
                updateGuild(ctx, dataToInit).then((guild) => {
                  if (guild) {
                    ctx.reply("Channel set");
                  } else {
                    ctx.reply("Creating and setting channel");
                    ctx.reply("Channel set");
                  }
                });
                // console.log(dataToSend);
              }
            });
          } else {
            ctx.reply("You can't set this channel as a text channel");
          }
        } else {
          ctx.reply("Invalid channelID");
        }
        //verify if the channelId is a category
      } else {
        ctx.reply("Please enter a channel ID after the command sw!set");
      }
    }
  }
});

const idchecker = async (number) => {
  let randomnumber = number;

  const guild = await db.collection("discord").findOne({
    serverid: `${number}`,
  });
  if (guild) {
    randomnumber = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
    idchecker(randomnumber);
  } else {
    return randomnumber;
  }
};

const updatePlayingNow = async (ctx, data) => {
  const guild = await db.collection("discord").findOne({
    serverdiscordid: ctx.guild.id,
  });
  if (guild) {
    guild.musicPlaying = { musicData: data, updateAt: new Date() };
    await db
      .collection("discord")
      .updateOne(
        { serverdiscordid: ctx.guild.id },
        { $set: { musicPlaying: guild.musicPlaying } }
      );
    return guild;
  }
};

const updateGuild = async (ctx, data) => {
  const guild = await db.collection("discord").findOne({
    serverdiscordid: ctx.guild.id,
  });
  if (guild) {
    //update the fisrt index of channels array with the data object
    guild.channels[0] = data;
    //update the database
    await db
      .collection("discord")
      .updateOne(
        { serverdiscordid: ctx.guild.id },
        { $set: { channels: guild.channels } }
      );
    return guild;
  } else {
    // console.log("error, updating");
    await initialDataChecker(ctx).then((guild) => {
      guild.channels[0] = data;
      db.collection("discord").updateOne(
        { serverdiscordid: ctx.guild.id },
        { $set: { channels: guild.channels } }
      );
      return guild;
    });
  }
};

const initialDataChecker = async (ctx) => {
  const guild = await db.collection("discord").findOne({
    serverdiscordid: ctx.guild.id,
  });
  if (!guild) {
    // let randomnumber must be a random number between 100000 and 999999
    let randomnumber =
      Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
    const result = await idchecker(randomnumber);

    if (result) {
      const newGuild = {
        serverid: `${result}`,
        serverdiscordid: ctx.guild.id,
        servername: ctx.guild.name,
        servericon: `https://cdn.discordapp.com/icons/${ctx.guild.id}/${ctx.guild.icon}.png`,
        channels: [],
        musicPlaying: {},
      };
      await db.collection("discord").insertOne(newGuild);
      return newGuild;
    }
  } else {
    return guild;
  }
};

client.on("messageCreate", (message) => {
  let musicData = {};
  if (message.author.id === "547905866255433758") {
    initialDataChecker(message).then((guild) => {
      try {
        message.embeds[0].description;
        const embed = message.embeds[0];
        const embed_title = embed.title;
        const embed_description = embed.description;

        if (embed_title == "Now playing") {
          // Separate the song name from the artist name
          const song_name = embed_description.split(" - ")[1];
          const artist_name = embed_description.split(" - ")[0];
          musicData = {
            author: artist_name,
            music: song_name,
          };

          updatePlayingNow(message, musicData).then((guild) => {
            // console.log(guild);
          });
        }
      } catch (err) {
        return;
      }
    });
  }
});
client.on("voiceStateUpdate", (oldMember, newMember) => {
  // console.log("Iniciando serviço");
  // Get the channel name and list all users in it
  const channelIDJoin = newMember.channelId;
  const channelIDLeave = oldMember.channelId;

  // check if the oldMember equals the newMember unless the channelId
  if (
    oldMember.selfMute != newMember.selfMute ||
    oldMember.selfDeaf != newMember.selfDeaf ||
    oldMember.selfVideo != newMember.selfVideo ||
    oldMember.serverMute != newMember.serverMute ||
    oldMember.serverDeaf != newMember.serverDeaf
  ) {
    return;
  } else {
  }
  let dataToSend = {};
  initialDataChecker(newMember).then((guild) => {
    // console.log("Geolocalizando");
    // console.log(guild.channels.length);
    if (guild.channels.length == 1) {
      channelIDinfo = guild.channels[0].channelId;
      if (channelIDJoin == channelIDinfo) {
        client.channels.fetch(channelIDJoin).then((channel) => {
          if (channel) {
            dataToSend = {
              channel: channel.name,
              channelId: channel.id,
              users: channel.members.map((member) => member.user.id),
              isMusicBotPlaying: channel.members
                .map((member) => member.user.id)
                .includes("547905866255433758"),
            };
            // console.log(dataToSend);
            updateGuild(newMember, dataToSend).then((guild) => {
              // console.log("Geolocalizado! 🗺️");
            });
          }
        });
      }
      if (channelIDLeave == channelIDinfo) {
        client.channels.fetch(channelIDLeave).then((channel) => {
          if (channel) {
            dataToSend = {
              channel: channel.name,
              channelId: channel.id,
              users: channel.members.map((member) => member.user.id),
              isMusicBotPlaying: channel.members
                .map((member) => member.user.id)
                .includes("547905866255433758"),
            };
            updateGuild(newMember, dataToSend).then((guild) => {
              // console.log("Geolocalizado! 🗺️");
            });
            // console.log(dataToSend);
          }
        });
      }
    } else {
      // console.log("Não foi possivel geolocalizar");
    }
  });
});

client.login(process.env.DISCORD_TOKEN);
