const fillSlots = (target, prefix, count) => {
  const el = document.getElementById(target);
  for (let i = 1; i <= count; i++) {
    const div = document.createElement('div');
    div.className = 'slot';
    div.textContent = `${prefix} ${i} — Video Upload Placeholder`;
    el.appendChild(div);
  }
};
fillSlots('courseGrid', 'Course Slot', 24);
fillSlots('pathGrid', 'Learning Path Slot', 12);
fillSlots('instructorGrid', 'Instructor Profile Slot', 10);
fillSlots('uploadGrid', 'Upload Zone', 16);

const out = document.getElementById('authOutput');

async function post(url, data) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { status: res.status, data: await res.json() };
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const result = await post('/api/auth/signup', data);
  out.textContent = JSON.stringify(result, null, 2);
});

document.getElementById('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const result = await post('/api/auth/signin', data);
  out.textContent = JSON.stringify(result, null, 2);
});
