window.appState = window.appState || {};
if (!window.appState.chats) window.appState.chats = [];

async function loadChats() {
    try {
        const res = await fetch('/api/chats');
        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                window.appState.chats = json.data || [];
                updateChatNotificationBadges();
            }
        }
    } catch (e) {
        console.error("Failed to load chats", e);
    }
}

window.updateChatNotificationBadges = function() {
    if (!window.appState.settings?.chatEnabled) return;
    const currentUser = window.appState.currentUser;
    if (!currentUser) return;

    let unreadCount = 0;
    
    if (currentUser.role === 'admin') {
        // Admin unread: messages sent to admin that are not read
        unreadCount = window.appState.chats.filter(c => String(c.receiverId) === 'admin' && !c.read).length;
    } else if (currentUser.role === 'student' || currentUser.role === 'murid' || currentUser.role === 'class_leader' || currentUser.role === 'ketua_kelas') {
        // Student unread: messages sent to this student that are not read
        unreadCount = window.appState.chats.filter(c => String(c.receiverId) === String(currentUser.id) && !c.read).length;
        
        // Update sidebar and header badges
        const chatAdminBtns = document.querySelectorAll('button[onclick="openChatWithAdmin()"]');
        chatAdminBtns.forEach(chatAdminBtn => {
            let badge = chatAdminBtn.querySelector('.chat-badge');
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'chat-badge ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full';
                    chatAdminBtn.appendChild(badge);
                }
                badge.innerText = unreadCount;
            } else if (badge) {
                badge.remove();
            }
        });
    }

    // Admin UI: update badges on student list if admin is active
    if (currentUser.role === 'admin') {
        const adminSidebarBtn = document.querySelector('button[onclick="navigateTo(\'siswa\')"]');
        if (adminSidebarBtn) {
            let badge = adminSidebarBtn.querySelector('.chat-badge');
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'chat-badge ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full';
                    adminSidebarBtn.appendChild(badge);
                }
                badge.innerText = unreadCount;
            } else if (badge) {
                badge.remove();
            }
        }
        
        // Update badges on student table buttons
        document.querySelectorAll('.student-chat-btn').forEach(btn => {
            const stId = btn.getAttribute('data-studentid');
            const studentUnread = window.appState.chats.filter(c => String(c.senderId) === String(stId) && String(c.receiverId) === 'admin' && !c.read).length;
            let stBadge = btn.querySelector('.chat-badge');
            if (studentUnread > 0) {
                if (!stBadge) {
                    stBadge = document.createElement('span');
                    stBadge.className = 'chat-badge absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white';
                    btn.appendChild(stBadge);
                }
                stBadge.innerText = studentUnread;
            } else if (stBadge) {
                stBadge.remove();
            }
        });
    }
}

window.openChatWithStudent = function(studentId) {
    if (window.appState.settings?.chatEnabled !== true && window.appState.settings?.chatEnabled !== 'true') {
        window.showToast("Fitur chat saat ini dinonaktifkan.", "error");
        return;
    }
    const student = window.appState.students.find(s => String(s.id) === String(studentId));
    if (!student) return;
    
    // Render the chat modal instantly first
    renderChatModal(student.id, student.name, 'admin', student.id);
    
    // Fetch and sync in the background
    loadChats().then(() => {
        markChatAsRead(student.id, 'admin');
        refreshChatMessages('admin', student.id);
    });
}

window.openChatWithAdmin = function() {
    if (window.appState.settings?.chatEnabled !== true && window.appState.settings?.chatEnabled !== 'true') {
        window.showToast("Fitur chat saat ini dinonaktifkan.", "error");
        return;
    }
    const student = window.appState.currentUser;
    if (!student || (student.role !== 'student' && student.role !== 'murid' && student.role !== 'class_leader' && student.role !== 'ketua_kelas')) return;
    
    // Render the chat modal instantly first
    renderChatModal('admin', 'Administrator', student.id, 'admin');
    
    // Fetch and sync in the background
    loadChats().then(() => {
        markChatAsRead('admin', student.id);
        refreshChatMessages(student.id, 'admin');
    });
}

window.markChatAsRead = async function(senderId, receiverId) {
    try {
        await fetch('/api/chats/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId, receiverId })
        });
        
        // local update
        window.appState.chats.forEach(c => {
            if (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId)) {
                c.read = true;
            }
        });
        updateChatNotificationBadges();
    } catch(e){}
}

window.renderChatModal = function(targetId, targetName, senderId, receiverId) {
    const modal = document.getElementById('modal-container');
    const currentUser = window.appState.currentUser;
    const canDelete = currentUser?.role === 'admin' || currentUser?.role === 'teacher' || true;
    modal.innerHTML = `
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div class="bg-white w-full max-w-md h-[550px] flex flex-col rounded-3xl shadow-2xl overflow-hidden relative">
                <div class="bg-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3 text-white">
                        <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <h3 class="font-bold">${targetName}</h3>
                            <p class="text-[10px] text-blue-100 uppercase tracking-wider">Chat Session</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="clearAllChats('${senderId}', '${receiverId}')" class="w-8 h-8 flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white rounded-full transition" title="Kosongkan Chat"><i class="fa-solid fa-trash-can"></i></button>
                        <button type="button" onclick="closeModal()" class="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                
                <div id="chat-messages-container" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 relative">
                    <!-- Messages go here -->
                </div>
                
                <div class="p-3 bg-white border-t border-slate-100 shrink-0">
                    <div id="chat-attachment-preview" class="hidden mb-2 relative inline-block">
                        <img id="chat-preview-img" src="" class="h-16 w-16 object-cover rounded-xl border border-slate-200">
                        <video id="chat-preview-vid" src="" class="hidden h-16 w-16 object-cover rounded-xl border border-slate-200"></video>
                        <div id="chat-preview-doc" class="hidden h-16 w-16 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 text-xl"><i class="fa-solid fa-file"></i></div>
                        <button type="button" onclick="clearChatAttachment()" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <form onsubmit="sendChatMessage(event, '${senderId}', '${receiverId}', '${targetId}', '${targetName}')" class="flex items-end gap-2">
                        <label class="w-10 h-10 flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center cursor-pointer transition">
                            <i class="fa-solid fa-paperclip"></i>
                            <input type="file" id="chat-file-input" class="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.apk" onchange="handleChatAttachment(event)">
                        </label>
                        <input type="text" id="chat-message-input" class="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ketik pesan...">
                        <button type="submit" class="w-10 h-10 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md transition disabled:opacity-50">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    window.chatAttachmentData = null;
    refreshChatMessages(senderId, receiverId);
    
    // Auto-refresh chat every 15 seconds while modal is open
    if (window.chatInterval) clearInterval(window.chatInterval);
    window.chatInterval = setInterval(async () => {
        if (document.getElementById('chat-messages-container')) {
            await loadChats();
            refreshChatMessages(senderId, receiverId);
            markChatAsRead(targetId, senderId);
        } else {
            clearInterval(window.chatInterval);
        }
    }, 15000);
}

window.handleChatAttachment = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const maxMb = 2; // limit to 2MB to avoid local storage explosion
    if (file.size > maxMb * 1024 * 1024) {
        window.showToast("Ukuran file maksimal " + maxMb + "MB", "error");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const res = ev.target.result;
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        
        window.chatAttachmentData = { type, data: res, name: file.name };
        
        document.getElementById('chat-attachment-preview').classList.remove('hidden');
        document.getElementById('chat-preview-img').classList.add('hidden');
        document.getElementById('chat-preview-vid').classList.add('hidden');
        document.getElementById('chat-preview-doc').classList.add('hidden');
        
        if (type === 'image') {
            document.getElementById('chat-preview-img').src = res;
            document.getElementById('chat-preview-img').classList.remove('hidden');
        } else if (type === 'video') {
            document.getElementById('chat-preview-vid').src = res;
            document.getElementById('chat-preview-vid').classList.remove('hidden');
        } else {
            document.getElementById('chat-preview-doc').classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

window.clearChatAttachment = function() {
    window.chatAttachmentData = null;
    const preview = document.getElementById('chat-attachment-preview');
    if (preview) preview.classList.add('hidden');
    const input = document.getElementById('chat-file-input');
    if (input) input.value = '';
}

window.clearAllChats = async function(senderId, receiverId) {
    showConfirmModal("Apakah Anda yakin ingin mengosongkan semua pesan dalam obrolan ini?", async () => {
        try {
            await fetch('/api/chats/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId, receiverId })
            });
            window.appState.chats = (window.appState.chats || []).filter(c => !(
                (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId)) ||
                (String(c.senderId) === String(receiverId) && String(c.receiverId) === String(senderId))
            ));
            const currentModal = document.getElementById('chat-messages-container');
            if (currentModal) {
                refreshChatMessages(senderId, receiverId);
            }
            window.showToast("Obrolan berhasil dikosongkan");
        } catch (e) {
            window.showToast("Gagal mengosongkan obrolan", "error");
        }
    });
}

window.deleteChatMessage = async function(msgId, senderId, receiverId) {
    showConfirmModal("Apakah Anda yakin ingin menghapus pesan ini?", async () => {
        try {
            await fetch('/api/chats/' + msgId, { method: 'DELETE' });
            window.appState.chats = (window.appState.chats || []).filter(c => String(c.id) !== String(msgId));
            const currentModal = document.getElementById('chat-messages-container');
            if (currentModal) {
                await loadChats();
                refreshChatMessages(senderId, receiverId);
            }
            window.showToast("Pesan berhasil dihapus");
        } catch(e) {
            window.showToast("Gagal menghapus pesan: " + e.message, "error");
        }
    });
}

window.refreshChatMessages = function(senderId, receiverId) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    const currentUser = window.appState.currentUser;
    const isAdmin = currentUser?.role === 'admin';
    const isTeacher = currentUser?.role === 'teacher';
    
    const messages = (window.appState.chats || []).filter(c => 
        (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId)) ||
        (String(c.senderId) === String(receiverId) && String(c.receiverId) === String(senderId))
    ).sort((a, b) => a.timestamp - b.timestamp);
    
    if (messages.length === 0) {
        container.innerHTML = `<div class="flex h-full items-center justify-center flex-col text-slate-400 gap-2"><i class="fa-regular fa-comments text-4xl"></i><p class="text-xs">Belum ada pesan.</p></div>`;
        return;
    }
    
    let html = '';
    messages.forEach(msg => {
        const isMine = String(msg.senderId) === String(senderId);
        const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        let attachmentHtml = '';
        if (msg.attachment) {
            if (msg.attachment.type === 'image') {
                attachmentHtml = `<img src="${msg.attachment.data}" class="max-w-full rounded-xl mb-2 border border-black/10">`;
            } else if (msg.attachment.type === 'video') {
                attachmentHtml = `<video src="${msg.attachment.data}" controls class="max-w-full rounded-xl mb-2 border border-black/10"></video>`;
            } else if (msg.attachment.type === 'apk' || String(msg.attachment.name || '').endsWith('.apk')) {
                attachmentHtml = `
                    <div class="p-3 bg-slate-900 text-white rounded-xl mb-2 flex items-center justify-between border border-slate-700/50">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-sm"><i class="fa-solid fa-mobile-screen-button"></i></div>
                            <div>
                                <h4 class="text-[10px] font-extrabold truncate w-[130px] text-emerald-400">${msg.attachment.name}</h4>
                                <p class="text-[8px] text-slate-400 mt-0.5">Android Companion App</p>
                            </div>
                        </div>
                        <a href="${msg.attachment.data}" download="${msg.attachment.name}" class="p-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"><i class="fa-solid fa-download"></i> Unduh</a>
                    </div>
                `;
            } else {
                attachmentHtml = `<a href="${msg.attachment.data}" download="${msg.attachment.name}" class="flex items-center gap-2 p-2 bg-black/10 rounded-xl mb-2 text-xs hover:bg-black/20 transition"><i class="fa-solid fa-file"></i> ${msg.attachment.name}</a>`;
            }
        }
        
        const canDeleteThis = isAdmin || isTeacher || isMine;
        const delBtn = canDeleteThis ? `<button type="button" onclick="deleteChatMessage('${msg.id}', '${senderId}', '${receiverId}')" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition shrink-0 cursor-pointer" title="Hapus Pesan"><i class="fa-solid fa-trash text-xs"></i></button>` : '';
        const delBtnOther = (isAdmin || isTeacher) ? `<button type="button" onclick="deleteChatMessage('${msg.id}', '${senderId}', '${receiverId}')" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition shrink-0 cursor-pointer" title="Hapus Pesan"><i class="fa-solid fa-trash text-xs"></i></button>` : '';

        if (isMine) {
            html += `
                <div class="flex items-center justify-end gap-1.5 group relative" data-senderid="${senderId}" data-receiverid="${receiverId}">
                    ${delBtn}
                    <div class="max-w-[80%] bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm relative">
                        ${attachmentHtml}
                        ${msg.text ? `<p class="text-sm break-words">${msg.text}</p>` : ''}
                        <div class="flex items-center justify-end gap-1 mt-1">
                            <p class="text-[10px] text-blue-200 text-right">${time}</p>
                            ${msg.read ? '<i class="fa-solid fa-check-double text-[10px] text-blue-300"></i>' : '<i class="fa-solid fa-check text-[10px] text-blue-200"></i>'}
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="flex items-center justify-start gap-1.5 group relative" data-senderid="${receiverId}" data-receiverid="${senderId}">
                    <div class="max-w-[80%] bg-white border border-slate-100 text-slate-700 p-3 rounded-2xl rounded-tl-sm shadow-sm relative">
                        ${attachmentHtml}
                        ${msg.text ? `<p class="text-sm break-words">${msg.text}</p>` : ''}
                        <p class="text-[10px] text-slate-400 mt-1">${time}</p>
                    </div>
                    ${delBtnOther}
                </div>
            `;
        }
    });
    
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    
    container.innerHTML = html;
    
    if (isAtBottom || window.forceChatScroll) {
        container.scrollTop = container.scrollHeight;
        window.forceChatScroll = false;
    }
}

window.sendChatMessage = async function(e, senderId, receiverId, targetId, targetName) {
    e.preventDefault();
    const input = document.getElementById('chat-message-input');
    const text = input.value.trim();
    if (!text && !window.chatAttachmentData) return;
    
    input.value = '';
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    
    const newMsg = {
        id: Date.now().toString(),
        senderId,
        receiverId,
        text,
        timestamp: Date.now(),
        read: false,
        attachment: window.chatAttachmentData
    };
    
    clearChatAttachment();
    
    // Optimistic update
    window.appState.chats.push(newMsg);
    window.forceChatScroll = true;
    refreshChatMessages(senderId, receiverId);
    
    try {
        const res = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMsg)
        });
        if (!res.ok) throw new Error("Gagal mengirim pesan");
    } catch (err) {
        window.showToast("Gagal mengirim pesan, periksa koneksi.", "error");
    } finally {
        btn.disabled = false;
        input.focus();
    }
}

// Global initialization
if (typeof window !== 'undefined') {
    // Initial load
    setTimeout(() => {
        loadChats();
    }, 1000);
    
    // Poll globally every 45 seconds for notifications when tab is visible
    setInterval(() => {
        if (document.visibilityState === 'visible' && window.appState?.settings?.chatEnabled) {
            loadChats();
        }
    }, 45000);
}
