class ReportsFilters {
  const ReportsFilters({this.status, this.urgency, this.districtId});

  final String? status;
  final String? urgency;
  final String? districtId;

  ReportsFilters copyWith({
    String? status,
    bool clearStatus = false,
    String? urgency,
    bool clearUrgency = false,
    String? districtId,
    bool clearDistrictId = false,
  }) {
    return ReportsFilters(
      status: clearStatus ? null : (status ?? this.status),
      urgency: clearUrgency ? null : (urgency ?? this.urgency),
      districtId: clearDistrictId ? null : (districtId ?? this.districtId),
    );
  }
}

const kReportStatusFilters = <String, String>{
  'pending': 'Chờ xử lý',
  'verifying': 'Đang xác minh',
  'confirmed_true': 'Đúng sự thật',
  'confirmed_false': 'Tin sai',
};
