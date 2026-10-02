const db = window.supabase.createClient(
    "https://gxnokcgzrkxkbawrehyi.supabase.co",
    "sb_publishable_ama1r5GgEnfIMtdyC2U82A_itUx23cW"
);
const BUCKET = "qr-images";
const MAX_SIDE = 1280; 

const $ = (id) => document.getElementById(id);
const imageInput = $("imageInput"), preview = $("preview"), fileInput = $("fileInput"),
      placeholder = $("placeholder"), removeBtn = $("removeBtn"), textInput = $("textInput"),
      form = $("formGenarate"), generateBtn = $("generateBtn"), statusEl = $("status"),
      output = $("output"), qrBox = $("qrcode"), linkText = $("linkText"), downloadBtn = $("downloadBtn");

let selectedFile = null;   
let selectedUrl = null;    
let qr = null;
const pasteBtn = $("pasteBtn");

function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.className = isError ? "error" : "";
}

function showPreviewBox() {
    preview.style.display = "block";
    placeholder.style.display = "none";
    removeBtn.style.display = "block";
}

function showPreview(file) {       
    selectedFile = file; selectedUrl = null;
    preview.src = URL.createObjectURL(file);
    showPreviewBox();
}

function showPreviewUrl(url) {          
    selectedUrl = url; selectedFile = null;
    preview.src = url;
    showPreviewBox();
}


preview.addEventListener("error", () => {
    if (selectedUrl) { clearImage(); setStatus("That link is not a usable image.", true); }
});

function clearImage() {
    selectedFile = null; selectedUrl = null;
    fileInput.value = "";
    preview.removeAttribute("src");
    preview.style.display = "none";
    placeholder.style.display = "";
    removeBtn.style.display = "none";
}

imageInput.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("click", (e) => e.stopPropagation());
removeBtn.addEventListener("click", (e) => { e.stopPropagation(); clearImage(); });

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) showPreview(file);
});

document.addEventListener("paste", (e) => {
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find((i) => i.type.startsWith("image/"));
    if (imgItem) {
        e.preventDefault();
        showPreview(imgItem.getAsFile());
        return setStatus("Image pasted.");
    }
    if (document.activeElement === textInput) return;  
    const txt = (e.clipboardData?.getData("text") || "").trim();
    if (/^https?:\/\/\S+$/i.test(txt)) {
        showPreviewUrl(txt);
        setStatus("Image link pasted.");
    }
});

pasteBtn.addEventListener("click", async () => {
    try {
        for (const item of await navigator.clipboard.read()) {
            const type = item.types.find((t) => t.startsWith("image/"));
            if (type) {
                const blob = await item.getType(type);
                showPreview(new File([blob], "pasted.png", { type }));
                return setStatus("Image pasted.");
            }
        }
        const txt = (await navigator.clipboard.readText()).trim();
        if (/^https?:\/\/\S+$/i.test(txt)) { showPreviewUrl(txt); return setStatus("Image link pasted."); }
        setStatus("No image in the clipboard. Copy an image first.", true);
    } catch {
        setStatus("Clipboard blocked. Allow access, or choose the file instead.", true);
    }
});

imageInput.addEventListener("dragover", (e) => e.preventDefault());
imageInput.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) showPreview(f);
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85);
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => reject(new Error("Invalid image file"));
        img.src = URL.createObjectURL(file);
    });
}

async function uploadImage(file) {
    const blob = await compressImage(file);
    const path = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function drawQR(url) {
    qrBox.innerHTML = "";
    qr = new QRCode(qrBox, {
        text: url, width: 256, height: 256,
        colorDark: "#000000", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
    });
    linkText.textContent = url;
    output.style.display = "block";
    output.scrollIntoView({ behavior: "smooth" });
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!selectedFile && !selectedUrl && !text) return setStatus("Please add an image or some text.", true);

    generateBtn.disabled = true;
    try {
        setStatus(selectedFile ? "Uploading image…" : "Saving…");
        const image_url = selectedFile ? await uploadImage(selectedFile) : selectedUrl;

        const id = crypto.randomUUID();   // generated here, so the table needs no default
        const { error } = await db.from("qr_items")
            .insert({ id, text_content: text || null, image_url });
        if (error) throw error;

        const viewUrl = new URL("view.html", location.href);
        viewUrl.search = new URLSearchParams({ id });
        drawQR(viewUrl.href);

        const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
        setStatus(local
            ? "Done! Note: phones can't open a localhost link. Deploy the site to scan it."
            : "Done! Scan the code with your phone.");
    } catch (err) {
        console.error(err);
        setStatus("Error: " + (err.message || "something went wrong"), true);
    } finally {
        generateBtn.disabled = false;
    }
});

downloadBtn.addEventListener("click", () => {
    const canvas = qrBox.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qrcode.png";
    a.click();
});