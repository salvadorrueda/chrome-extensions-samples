const applyColor = (color) => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (bg) => {
        document.documentElement.style.setProperty(
          '--ext-original-bg',
          document.body.style.backgroundColor || ''
        );
        document.body.style.backgroundColor = bg;
      },
      args: [color]
    });
  });
};

const resetColor = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.body.style.backgroundColor = '';
      }
    });
  });
};

document.querySelectorAll('.color-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyColor(btn.dataset.color));
});

document.getElementById('apply-custom').addEventListener('click', () => {
  const color = document.getElementById('custom-color').value;
  applyColor(color);
});

document.getElementById('reset-btn').addEventListener('click', resetColor);
