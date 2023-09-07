// vars
const player = document.querySelector("#player");
let videoHistory = JSON.parse(sessionStorage.getItem("videoHistory") || "[]") || [];
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
let currentIndex = 0;

function enableButton(buttonId, eventListener) {
  document.getElementById(buttonId).disabled = false;
  if (eventListener) {
    player.removeEventListener("loadedmetadata", eventListener);
    player.removeEventListener("error", eventListener);
  }
}

// next video logic
document.getElementById("nextVideo").addEventListener("click", () => {
  document.getElementById("nextVideo").disabled = true;

  const nextVideoListener = () => enableButton("nextVideo", nextVideoListener);

  if (currentIndex < videoHistory.length - 1) {
    currentIndex++;
    player.src = videoHistory[currentIndex];
  } else {
    fetch("/api/link")
      .then(res => res.text())
      .then(line => {
        // No need to push the current player.src into videoHistory again
        // Only push the new video URL
        videoHistory.push(line);
        currentIndex++;

        player.src = line;
        checkVideo(line);
        sessionStorage.setItem("videoHistory", JSON.stringify(videoHistory));
        console.log("New video:", line);
        console.log("Video history:", videoHistory);
      });
  }

  player.addEventListener("loadedmetadata", nextVideoListener);
  player.addEventListener("error", nextVideoListener);
});

// previous video logic
document.getElementById("prevVideo").addEventListener("click", () => {
  document.getElementById("prevVideo").disabled = true;

  const prevVideoListener = () => enableButton("prevVideo", prevVideoListener);

  if (currentIndex > 0) {
    currentIndex--;
    player.src = videoHistory[currentIndex];
  } else {
    // If already at the start, enable the button
    enableButton("prevVideo");
    return;
  }

  player.addEventListener("loadedmetadata", prevVideoListener);
  player.addEventListener("error", prevVideoListener);
});

// info button logic
document.querySelector("button:nth-child(2)").addEventListener("click", () => {
  showModal("Information about this site:", "This site uses CDN links that have been gathered from Discord channels. They have been submitted by random users, because of this we are not responsible for what videos show up on your screen.");
});
document.getElementById("closeModal").addEventListener("click", () => {
  document.getElementById("infoModal").classList.add("hidden");
});

// button to view history and copy link logic
document.getElementById("viewHistory").addEventListener("click", () => {
  console.log("Video history:", videoHistory);

  navigator.clipboard.writeText(player.src)
    .then(() => {
      console.log("URL successfully copied to clipboard!", player.src);
    })
    .catch(err => {
      console.log("Failed to copy URL: ", err);
    });

  showModal("Video Actions", `<span class="text-green-300">Current link copied!</span> ${ videoHistory.length ? `Here's your history:<br><br>${ videoHistory.map((link) => `<a href="${ link }" target="_blank" class="text-blue-300 hover:text-blue-200">${ link.split("/").pop() }</a>`).join("<br>") }` : "Your history is unavailable, try watching some videos first!" }`, `
    <div class="flex gap-2">
      <button id="clearHistory" class="bg-secondary-button hover:bg-secondary-button-hover text-white py-2 px-4 rounded" onclick="sessionStorage.removeItem('videoHistory'); videoHistory = []; currentIndex = 0; showModal('Success', 'Your watch history has been cleared!', null);">Clear History</button>
      <button id="reportLink" class="bg-danger-button hover:bg-danger-button-hover text-white py-2 px-4 rounded" onclick="window.open('https://github.com/TubeCord/database/issues/new?labels=report&title=[REPORT]%20Bad%20Link&body=Link:%20${ player.src }%0AWhy%20this%20link%20is%20bad:%20');">Report Link</button>
    </div>
  `);
});

// error function to show error message & show error message if video is a .mov file
function error(title, message) {
  if (!title || !message) {
    return document.getElementById("errorCard").classList.add("hidden");
  }

  document.getElementById("errorCard").classList.remove("hidden");
  errorTitle.innerHTML = title.trim();
  errorMessage.innerHTML = message.trim();
}

function checkVideo(videoUrl) {
  fetch("/api/check-video?url=" + encodeURIComponent(videoUrl))
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        error(data.error, data.message);
      }
    });
}

// modal logic
function showModal(title, message, extraContent) {
  document.getElementById("modalTitle").innerHTML = title;
  document.getElementById("modalMessage").innerHTML = message;
  if (extraContent || extraContent === null) document.getElementById("extraContent").innerHTML = extraContent;
  document.getElementById("infoModal").classList.remove("hidden");
}

// debug shit
function setDummyLinks(confirm) {
  if (!confirm || confirm !== window.DUMMY_LINKS_CONFIRM) {
    window.DUMMY_LINKS_CONFIRM = Math.floor(Math.random() * 9999);
    console.log(`This will completely overwrite your current history. If you are sure, run this function again like this: setDummyLinks(${ window.DUMMY_LINKS_CONFIRM })`);
    return;
  }

  window.DUMMY_LINKS_CONFIRM = undefined;
  const DEBUG_ARRAY = [];

  for (let i = 1; i <= 100; i++) {
    const extension = Math.random() < 0.5 ? 'mp4' : 'mov';
    const videoURL = `${ location.protocol }//${ location.host }/dummy/video${ i }.${ extension }`;
    DEBUG_ARRAY.push(videoURL);
  }

  videoHistory = DEBUG_ARRAY;
  sessionStorage.setItem('videoHistory', JSON.stringify(videoHistory));
  if (videoHistory.length === 100) {
    return console.log('Dummy links set!');
  } else {
    return console.log('Something went wrong while setting the dummy links :(');
  }
}
