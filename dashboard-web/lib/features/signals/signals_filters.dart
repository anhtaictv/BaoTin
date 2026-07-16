class SignalsFilters {
  const SignalsFilters({this.districtId, this.trustLevel});

  final String? districtId;
  final String? trustLevel;

  SignalsFilters copyWith({String? districtId, bool clearDistrictId = false, String? trustLevel, bool clearTrustLevel = false}) {
    return SignalsFilters(
      districtId: clearDistrictId ? null : (districtId ?? this.districtId),
      trustLevel: clearTrustLevel ? null : (trustLevel ?? this.trustLevel),
    );
  }
}

const kTrustLevelFilters = <String, String>{
  'verified_press': 'Báo chí',
  'unverified_social': 'MXH',
};
