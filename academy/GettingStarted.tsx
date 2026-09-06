import React, { useState } from 'react'
import messageBox from './assets/chatgpt-message-box.jpg'
import './getting-started.css'

const firstPrompt = 'Suggest three simple activities for a family gathering.'
const followUp = 'Make them suitable for indoors, without buying supplies.'
type Device = 'computer' | 'iphone' | 'android'
const devices: { id: Device; label: string }[] = [{ id: 'computer', label: 'Computer' }, { id: 'iphone', label: 'iPhone' }, { id: 'android', label: 'Android phone' }]

function Prompt({ text, label }: { text: string; label: string }) {
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage('Copied. Paste it into ChatGPT, then send it.') }
    catch { setMessage('Select the words above and copy them, or type them into ChatGPT.') }
  }
  return <div className="setup-prompt"><p>{text}</p><button onClick={copy}>{label}</button><p role="status">{message}</p></div>
}

export function GettingStarted({ onBack, onContinue }: { onBack: () => void; onContinue?: () => void }) {
  const [device, setDevice] = useState<Device>('computer')
  const phone = device !== 'computer'
  const [checks, setChecks] = useState([false, false, false])
  return <main className="portal-main setup-guide">
    <button className="setup-back" onClick={onBack}>Back to Phase One</button>
    <header><p className="eyebrow">Before your first lesson</p><h1>Getting Started with ChatGPT</h1><p>Open ChatGPT, send your first message, and return here to begin Lesson 1.1. Follow these steps at your own pace.</p></header>
    <fieldset className="setup-devices"><legend>Which device are you using?</legend>{devices.map(item => <label key={item.id}><input type="radio" name="setup-device" value={item.id} checked={device === item.id} onChange={() => setDevice(item.id)} />{item.label}</label>)}</fieldset>
    <ol className="setup-steps">
      <li><h2>Open ChatGPT</h2>{phone ? <><p>Use the link below to open the official ChatGPT app listing. Check that the developer is OpenAI. {device === 'iphone' ? 'Tap Get (or the download symbol) and confirm the download on your phone.' : 'Tap Install and wait for the download to finish.'} Then tap Open. If it is already installed, tap Open.</p><a className="setup-link" href={device === 'iphone' ? 'https://apps.apple.com/app/openai-chatgpt/id6448311069' : 'https://play.google.com/store/apps/details?id=com.openai.chatgpt'} target="_blank" rel="noopener noreferrer">{device === 'iphone' ? 'Open ChatGPT in the App Store' : 'Open ChatGPT in Google Play'}</a><p>Prefer to use your browser? <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT in a new tab</a>. A download is optional.</p></> : <><p>Select the button below. ChatGPT opens in another browser tab, so this Academy page stays open. You do not need to download a computer app.</p><a className="setup-link" href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT in a new tab</a></>}<p>A free ChatGPT account is enough for this exercise.</p></li>
      <li><h2>Sign in or create your account</h2><p>If you already have a ChatGPT account, choose Log in and use the same sign-in method you used before. If you are new, choose Sign up and follow the instructions for your chosen method.</p><p>If you choose email and are asked for a verification code, open your email, find the message from OpenAI, and enter the code on the ChatGPT sign-in screen. Keep passwords and codes out of the chat message box.</p><p>When the message box appears, you can begin. Some browsers also let you try ChatGPT without signing in; signing in lets you return to your saved conversations.</p></li>
      <li><h2>Send your first message</h2><p>A prompt is the question or instruction you give AI. {phone ? 'Tap' : 'Click'} the message box, type or paste the request below, then select the send arrow beside it.</p><Prompt text={firstPrompt} label="Copy first message" />{!phone && <figure><img src={messageBox} alt="ChatGPT message box containing the family gathering request. The send button is the upward arrow at the far right." /><figcaption>Computer example: your words go in the message box; the upward arrow sends them. Other controls can vary by account.</figcaption></figure>}<p>Wait for the reply. Read the suggestions and consider which would suit your gathering. Your answer may differ from someone else’s.</p></li>
      <li><h2>Ask for a change</h2><p>Keep the same conversation open. In the message box below the reply, enter this follow-up and send it.</p><Prompt text={followUp} label="Copy follow-up message" /><p>Read the new reply. Are the activities suitable for indoors? Do they use things you already have? If a suggestion does not fit, say what needs changing.</p></li>
      <li><h2>Return to the Academy</h2>{phone ? <p>If you used the app, open your phone’s app switcher and select the browser where the Academy is open. On phones with gesture navigation, swipe up from the bottom and pause. On an iPhone with a Home button, press it twice; on Android with navigation buttons, tap the Recent apps button. If you used ChatGPT in your browser, open the browser’s tabs and select the Academy page.</p> : <p>At the top of your browser, select the tab with the Academy page. Leave the ChatGPT tab open so you can switch back during practice.</p>}<p>You have now tried giving an instruction, reading a response, and asking for a change.</p></li>
    </ol>
    <section className="setup-ready" aria-labelledby="setup-ready-title"><h2 id="setup-ready-title">Ready for Lesson 1.1?</h2><p>Use this checklist for yourself. It is not a graded assessment.</p>{['I opened ChatGPT and sent a message.', 'I read the reply and asked for a change.', 'I can return to the Academy and switch back to ChatGPT.'].map((label, index) => <label key={label}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(values => values.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}{checks.every(Boolean) && <p role="status">You are ready to begin Lesson 1.1.</p>}{onContinue && <button onClick={onContinue}>Continue to Lesson 1.1</button>}</section>
    <details className="setup-help"><summary>If something does not work</summary><p><strong>The link did not open:</strong> Open your browser, select its address bar, type chatgpt.com, and press Enter or Go.</p><p><strong>You cannot send:</strong> Check that words are in the message box and your internet connection is working. If ChatGPT asks you to sign in, complete that step first.</p><p><strong>A usage limit appears:</strong> Follow the time shown by ChatGPT and return to the exercise later. You can continue reading the Academy lesson while you wait.</p><p><strong>You lost the Academy tab:</strong> Reopen the Academy website, select Phase One, and open Getting Started with ChatGPT.</p></details>
    <details className="setup-help"><summary>Official ChatGPT instructions</summary><p><a href="https://help.openai.com/en/articles/9125172-the-chatgpt-home-page" target="_blank" rel="noopener noreferrer">Using ChatGPT on the web</a> · <a href="https://help.openai.com/en/articles/7908378-where-can-i-download-the-openai-chatgpt-ios-app-on-the-apple-app-store" target="_blank" rel="noopener noreferrer">Official iPhone app</a> · <a href="https://help.openai.com/en/articles/8142208-chatgpt-android-app-faq" target="_blank" rel="noopener noreferrer">Official Android app</a></p></details>
  </main>
}
