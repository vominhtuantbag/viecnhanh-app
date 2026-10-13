export const JOB_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ASSIGNED: 'assigned',
  COMPLETED: 'completed',
  CLOSED: 'closed',
};

export const BID_FEE = 3000;

export const STATUS_LABELS = {
  pending: 'Chờ duyệt',
  approved: 'Đang mở',
  assigned: 'Đã nhận',
  completed: 'Hoàn thành',
  closed: 'Đã đóng',
};

export const HIRE_CANCEL_REASONS = [
  { id: 'no_pickup', label: 'Gọi thợ không bắt máy' },
  { id: 'overdue', label: 'Quá hạn thời gian' },
  { id: 'not_as_promised', label: 'Không đúng cam kết' },
  { id: 'no_show', label: 'Thợ không đến làm' },
  { id: 'other', label: 'Lý do khác' },
];

export function formatPrice(value) {
  const number = Number(value) || 0;
  return `${number.toLocaleString('vi-VN')} đ`;
}

export function formatDistance(km) {
  if (!km) return 'Gần bạn';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function offerLabel(count) {
  return `${count} đề xuất`;
}

export function viewLabel(count) {
  const value = Number(count) || 0;
  return `${value} lượt xem`;
}

export function questionLabel(count) {
  return `${count} câu hỏi`;
}

export function jobFlowStatus(job) {
  if (!job) return JOB_STATUS.APPROVED;
  if (job.status === JOB_STATUS.COMPLETED) return JOB_STATUS.COMPLETED;
  if (job.status === JOB_STATUS.CLOSED) return JOB_STATUS.CLOSED;
  if (job.status === JOB_STATUS.ASSIGNED || job.hiredWorkerId) return JOB_STATUS.ASSIGNED;
  if (job.status === JOB_STATUS.PENDING || job.isApproved === false) return JOB_STATUS.PENDING;
  return JOB_STATUS.APPROVED;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

export function isJobLive(job) {
  return jobFlowStatus(job) === JOB_STATUS.APPROVED;
}

export function isCurrentListing(job) {
  return jobFlowStatus(job) === JOB_STATUS.APPROVED;
}

export function shouldAutoApproveJob(existingJobs, profileId) {
  return !existingJobs.some((job) => job.userId === profileId && isCurrentListing(job));
}
