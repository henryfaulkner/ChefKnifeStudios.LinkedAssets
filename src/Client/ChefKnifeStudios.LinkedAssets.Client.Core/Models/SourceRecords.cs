using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Models;

public static class WireJson
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        Converters = { new NullableInstantConverter(), new OpaqueStringConverter() }
    };
}

// Keep malformed/missing instants unknown rather than failing an otherwise usable source.
public sealed class NullableInstantConverter : JsonConverter<DateTimeOffset?>
{
    public override DateTimeOffset? Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String && DateTimeOffset.TryParse(reader.GetString(), CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var value) && value.Year > 1) return value.ToUniversalTime();
        reader.Skip();
        return null;
    }
    public override void Write(Utf8JsonWriter writer, DateTimeOffset? value, JsonSerializerOptions options)
    { if (value is { } instant) writer.WriteStringValue(instant); else writer.WriteNullValue(); }
}

public sealed class OpaqueStringConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) => reader.TokenType switch
    {
        JsonTokenType.String => reader.GetString(),
        JsonTokenType.Number => JsonDocument.ParseValue(ref reader).RootElement.GetRawText(),
        _ => throw new JsonException("Invalid opaque value.")
    };
    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options) => writer.WriteStringValue(value);
}

// A malformed end must never become an open interval. MinValue is an invalid marker.
public sealed class EndInstantConverter : JsonConverter<DateTimeOffset?>
{
    public override DateTimeOffset? Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
        new NullableInstantConverter().Read(ref reader, type, options) ?? DateTimeOffset.MinValue;
    public override void Write(Utf8JsonWriter writer, DateTimeOffset? value, JsonSerializerOptions options) =>
        new NullableInstantConverter().Write(writer, value, options);
}

public record EntityRef([property: JsonPropertyName("id")] string? Id);
public record DeviceDto([property: JsonPropertyName("id")] string? Id, [property: JsonPropertyName("name")] string? Name);
public record AssetLinkDto(
    [property: JsonPropertyName("id")] string? Id,
    [property: JsonPropertyName("linkType")] string? LinkType,
    [property: JsonPropertyName("isActive")] bool? IsActive,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("version")] string? Version,
    [property: JsonPropertyName("assetLinkDetails")] AssetLinkDetailsDto[]? AssetLinkDetails);
public record AssetLinkDetailsDto(
    [property: JsonPropertyName("id")] string? Id,
    [property: JsonPropertyName("assetLinkId")] string? AssetLinkId,
    [property: JsonPropertyName("device")] EntityRef? Device,
    [property: JsonPropertyName("activeFrom")] DateTimeOffset? ActiveFrom,
    [property: JsonPropertyName("activeTo"), JsonConverter(typeof(EndInstantConverter))] DateTimeOffset? ActiveTo);
public record DeviceLinkDto(
    [property: JsonPropertyName("id")] string? Id,
    [property: JsonPropertyName("sourceDevice")] EntityRef? SourceDevice,
    [property: JsonPropertyName("destinationDevice")] EntityRef? DestinationDevice,
    [property: JsonPropertyName("linkType")] string? LinkType,
    [property: JsonPropertyName("fromDate")] DateTimeOffset? FromDate,
    [property: JsonPropertyName("toDate"), JsonConverter(typeof(EndInstantConverter))] DateTimeOffset? ToDate,
    [property: JsonPropertyName("version")] string? Version);
public record DeviceStatusInfoDto(
    [property: JsonPropertyName("device")] EntityRef? Device,
    [property: JsonPropertyName("latitude")] double? Latitude,
    [property: JsonPropertyName("longitude")] double? Longitude,
    [property: JsonPropertyName("dateTime")] DateTimeOffset? DateTime);
