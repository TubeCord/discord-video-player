// vars
const player = document.querySelector("#player");
let videoHistory = JSON.parse(sessionStorage.getItem("videoHistory") || "[]") || [];
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
let currentIndex = 0;

// Modal helpers
const modal = document.getElementById('infoModal');
const modalTransitionClasses = ['transition-opacity', 'duration-300', 'ease-in-out'];
let modalHideTimeout;

function showModal(title, message, extraContent) {
  if (!modal) return;

  document.getElementById("modalTitle").innerHTML = title;
  document.getElementById("modalMessage").innerHTML = message;
  if (extraContent || extraContent === null) document.getElementById("extraContent").innerHTML = extraContent;

  clearTimeout(modalHideTimeout);
  modal.classList.remove('hidden');
  modal.classList.add(...modalTransitionClasses);
  // ensure fade-in is applied even if it was mid-transition
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  });
}

function hideModal() {
  if (!modal || modal.classList.contains('hidden')) return;

  clearTimeout(modalHideTimeout);
  modal.classList.add(...modalTransitionClasses);
  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0');

  modalHideTimeout = setTimeout(() => {
    modal.classList.add('hidden');
    // reset state for next show
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
  }, 300);
}

// Check for the cookie and display modal if not present
const isFirstTimeVisitor = getCookie("firstTimeVisitor");
if (!isFirstTimeVisitor) {
  showModal("Important Disclaimer", "Our video database may include content that is NSFW, disturbing, loud, or features flashing lights. If you encounter videos that grossly violate Discord's Terms of Service, please use the 'More Actions' button to report them.<br><br>For videos containing child sexual abuse material (CSAM) or other abusive content, please report this as soon as possible and privately by going here: <a href=\"/encrypt\" class=\"text-blue-400 hover:text-blue-500\">encrypt and report</a>. If you publicly report content that contains child sexual abuse material (CSAM) or other forms of abuse, we will delete your issue to protect the victims involved.", "<button id=\"ageConfirm\" class=\"bg-secondary-button hover:bg-secondary-button-hover text-white py-2 px-4 rounded transition-all duration-200\" onclick=\"handleAgeConfirm(this)\">I am 18+ years old</button>");
  setCookie('firstTimeVisitor', 'false', 90);
}

function handleAgeConfirm(btn) {
  setCookie('legalUser', 'true', 90);
  btn.innerText = '✅';
  btn.disabled = true;

  hideModal();
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    hideModal();
  }
});

const enableButton = (buttonId, prevVideoListener) => {
  const button = document.getElementById(buttonId);
  if (button) {
    button.classList.remove("opacity-50", "cursor-not-allowed");
    button.disabled = false;
    if (prevVideoListener) {
      player.removeEventListener("loadedmetadata", prevVideoListener);
      player.removeEventListener("error", prevVideoListener);
    }
  }
  return button;
};

const disableButton = (buttonId) => {
  const button = document.getElementById(buttonId);
  if (button) {
    button.classList.add("opacity-50", "cursor-not-allowed");
    button.disabled = true;
  }
  return button;
};

// next video logic
document.getElementById("nextVideo").addEventListener("click", () => {
  disableButton("nextVideo");

  const nextVideoListener = () => enableButton("nextVideo", nextVideoListener);

  // Add the first video to videoHistory if it's not already there
  if (videoHistory.length === 0) {
    videoHistory.push(player.src);
    sessionStorage.setItem("videoHistory", JSON.stringify(videoHistory));
  }

  if (currentIndex < videoHistory.length - 1) {
    currentIndex++;
    player.src = videoHistory[currentIndex];
    checkVideo(player.src);
  } else {
    fetch("/api/link")
      .then(res => res.text())
      .then(line => {
        const proxied = '/stream?url=' + encodeURIComponent(line);
        videoHistory.push(proxied);
        currentIndex++;

        player.src = proxied;
        checkVideo(line); // Check the original URL or the proxied one? The API expects the original usually, but let's send what we have.
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
  const prevVideoListener = () => enableButton("prevVideo", prevVideoListener);

  if (currentIndex > 0) {
    // disable the button and proceed
    disableButton("prevVideo");

    currentIndex--;
    player.src = videoHistory[currentIndex];
    checkVideo(player.src);

    player.addEventListener("loadedmetadata", prevVideoListener);
    player.addEventListener("error", prevVideoListener);
  } else {
    // If already at the start, enable the button and remove stale event listeners
    enableButton("prevVideo", prevVideoListener);
    return;
  }
});

// info button logic
const infoBtn = document.getElementById("infoButton");
if (infoBtn) {
  infoBtn.addEventListener("click", () => {
    showModal("Information about this site:", "This site uses CDN links that have been gathered from Discord channels. They have been submitted by random users, because of this we are not responsible for what videos show up on your screen.", null);
  });
}
const closeModalButton = document.getElementById("closeModal");
if (closeModalButton) {
  closeModalButton.addEventListener("click", hideModal);
}

// Extract the original CDN URL from the proxied URL
function getDirectUrl(proxiedUrl) {
  try {
    const url = proxiedUrl.includes('://') ? new URL(proxiedUrl) : new URL(proxiedUrl, window.location.origin);
    const originalUrl = url.searchParams.get('url');
    return originalUrl || proxiedUrl;
  } catch {
    return proxiedUrl;
  }
}

// button to view history and copy link logic
document.getElementById("viewHistory").addEventListener("click", () => {
  console.log("Video history:", videoHistory);

  const directUrl = getDirectUrl(player.src);
  navigator.clipboard.writeText(directUrl)
    .then(() => {
      console.log("URL successfully copied to clipboard!", directUrl);
    })
    .catch(err => {
      console.log("Failed to copy URL: ", err);
    });

  showModal("Video Actions", `<span class="text-green-300">Current link copied!</span> ${videoHistory.length ? `Here's your history:<br><br>${videoHistory.map((link) => {
    const directUrl = getDirectUrl(link);
    const filename = decodeURIComponent(directUrl).split("/").pop().split("?")[0];
    return `<a href="${directUrl}" target="_blank" class="text-blue-300 hover:text-blue-200">${filename}</a>`;
  }).join("<br>")}` : "Your history is unavailable, try watching some videos first!"}`, `
    <div class="flex gap-2">
      <button id="clearHistory" class="bg-secondary-button hover:bg-secondary-button-hover text-white py-2 px-4 rounded" onclick="sessionStorage.removeItem('videoHistory'); videoHistory = []; currentIndex = 0; showModal('Success', 'Your watch history has been cleared!', null);">Clear History</button>
      <button id="reportLink" class="bg-danger-button hover:bg-danger-button-hover text-white py-2 px-4 rounded" onclick="window.open('https://github.com/TubeCord/database/issues/new?labels=report&title=[REPORT]%20Bad%20Link&body=Link:%20${player.src}%0AWhy%20this%20link%20is%20bad:%20');">Report Link</button>
    </div>
  `);
});

// download button logic
document.getElementById("downloadVideo").addEventListener("click", () => {
  const videoSrc = player.src;

  // try opening in a new tab
  const newWindow = window.open(videoSrc);

  // fallback to creating an anchor tag for download if pop-up is blocked
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = videoSrc;
    a.download = videoSrc.split("/").pop() || "tubecord_video.mp4";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
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
  const player = document.getElementById('player');
  const errorCard = document.getElementById('errorCard');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');

  // Hide error card initially
  errorCard.classList.add('hidden');

  // If video plays, force hide error card (fixes false positives)
  player.addEventListener('playing', () => {
    errorCard.classList.add('hidden');
  }, { once: true });

  fetch(`/api/check-video?url=${encodeURIComponent(videoUrl)}`)
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        // Only show error if the player hasn't started playing yet
        if (player.paused && player.readyState < 3) {
          // errorTitle.innerText = data.error;
          // errorMessage.innerText = data.message;
          // errorCard.classList.remove('hidden');
        }
      } else {
        errorCard.classList.add('hidden');
      }
    })
    .catch(error => {
      console.error('Error checking video:', error);
    });
}

// function to get a cookie by name
function getCookie(name) {
  const cookieArr = document.cookie.split('; ');

  for (let i = 0; i < cookieArr.length; i++) {
    const cookiePair = cookieArr[i].split('=');

    if (name == cookiePair[0]) {
      return decodeURIComponent(cookiePair[1]);
    }
  }
  return null;
};

// function to set a cookie
function setCookie(name, value, days) {
  let expires = '';

  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }

  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
};

// debug shit
function setDummyLinks(confirm) {
  if (!confirm || confirm !== window.DUMMY_LINKS_CONFIRM) {
    window.DUMMY_LINKS_CONFIRM = Math.floor(Math.random() * 9999);
    console.log(`This will completely overwrite your current history. If you are sure, run this function again like this: setDummyLinks(${window.DUMMY_LINKS_CONFIRM})`);
    return;
  }

  window.DUMMY_LINKS_CONFIRM = undefined;
  const DEBUG_ARRAY = [];

  for (let i = 1; i <= 100; i++) {
    const extension = Math.random() < 0.5 ? 'mp4' : 'mov';
    const videoURL = `${location.protocol}//${location.host}/dummy/video${i}.${extension}`;
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
// surface playback errors to user
player.addEventListener('error', () => {
  error('Playback Error', 'This video cannot be played due to Discord CDN restrictions or network issues. Try Next Video or reload.');
});

// Logo spin easter egg - Chrome-like animation
const logo = document.querySelector('img[alt*="logo"]');
if (logo) {
  let lastClickTime = 0;
  let rotation = 0;
  const spinDuration = 1200;
  const spinEasing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  logo.style.transition = `transform ${spinDuration}ms ${spinEasing}`;

  logo.addEventListener('click', () => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    // Double-click detected (within 500ms)
    if (timeDiff > 0 && timeDiff < 500) {
      rotation += 360;
      logo.style.transform = `rotate(${rotation}deg)`;
      lastClickTime = 0;
    } else {
      lastClickTime = currentTime;
    }
  });
}
