const vscode = acquireVsCodeApi();

document.getElementById('model').addEventListener('change', () => {
    vscode.postMessage({command: 'model', text: document.getElementById('model').value});
});

document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('chat').innerHTML = '';
    vscode.postMessage({command: 'clear'});
});

document.getElementById('send').addEventListener('click', () => {
    if (document.getElementById('prompt').value !== '') {
        sendPrompt();
    }
    
});

document.getElementById('prompt').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && document.getElementById('prompt').value !== '') {
        event.preventDefault(); // Prevent the default action of adding a new line
        sendPrompt();
    }
});

window.addEventListener('message', event => {
    const { command, text } = event.data;
    if (command === 'chatResponse') {
        updateResponseText(text);
    }
    if (command === 'models') {
        updateModels(text);
    }
    if (command === 'userMessage') {
        createUserMessage(text);
    }
    if (command === 'assistantMessage') {
        createAssistantMessage(text);
    }
});

const sendPrompt = () => {
    const text = document.getElementById('prompt').value;
    document.getElementById('prompt').value = '';
    createUserMessage(text);
    createAssistantMessage();
    vscode.postMessage({command: 'send', text});
    scrollToBottom();
};

const updateResponseText = (text) => {
    document.getElementById('response').innerHTML = marked.parse(text);
    Prism.highlightAll();
    scrollToBottom();
};

updateModels = (text) => {
    document.getElementById('model').innerHTML = '';
    text.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.innerHTML = model.name;
        document.getElementById('model').appendChild(option);
    });
};


const createUserMessage = (text) => {
    const message = document.createElement('div');
    const messageText = document.createElement('div');
    const icon = document.createElement('img');
    icon.src = "https://img.icons8.com/?size=48&id=kDoeg22e5jUY&format=png";
    icon.classList.add('icon');
    messageText.innerHTML = text;
    message.appendChild(icon);
    message.appendChild(messageText);
    message.classList.add('user_message');
    document.getElementById('chat').appendChild(message);
    scrollToBottom();
};

const createAssistantMessage = (text="") => {
    const message = document.createElement('div');
    const messageText = document.createElement('div');
    const icon = document.createElement('img');
    const response = document.getElementById('response');
    if (response) {
        response.id = 'old-response';
    }
    icon.src = "https://cdn-icons-png.flaticon.com/128/16921/16921802.png";
    icon.classList.add('icon');
    messageText.id = 'response';
    message.appendChild(icon);
    message.appendChild(messageText);
    message.classList.add('assistant_message');
    document.getElementById('chat').appendChild(message);
    if (text !== "") {
        messageText.innerHTML = marked.parse(text);
        Prism.highlightAll();
    }
    else {
        messageText.appendChild(createLoadingAnimation());
    }
    scrollToBottom();
};

const createLoadingAnimation = () => {
    const loading = document.createElement('div');
    loading.classList.add('loader');
    return loading;
};

function scrollToBottom() {
    const chatContainer = document.getElementById('chat');
    chatContainer.scrollTop = chatContainer.scrollHeight;
};