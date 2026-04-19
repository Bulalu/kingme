from __future__ import annotations

import torch
from torch import nn


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        return self.relu(x + residual)


class CheckersMoveNet(nn.Module):
    def __init__(
        self,
        input_channels: int,
        move_feature_size: int,
        channels: int = 64,
        residual_blocks: int = 4,
        hidden_size: int = 128,
    ):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(input_channels, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )
        self.trunk = nn.Sequential(*[ResidualBlock(channels) for _ in range(residual_blocks)])
        self.board_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(channels, hidden_size),
            nn.ReLU(inplace=True),
        )
        self.move_encoder = nn.Sequential(
            nn.Linear(move_feature_size, hidden_size),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(inplace=True),
        )
        self.policy_head = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_size, 1),
        )
        self.value_head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_size, 1),
            nn.Tanh(),
        )

    def forward(
        self,
        boards: torch.Tensor,
        move_features: torch.Tensor,
        move_mask: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        x = self.stem(boards)
        x = self.trunk(x)
        board_embedding = self.board_head(x)
        move_embedding = self.move_encoder(move_features)
        board_context = board_embedding.unsqueeze(1).expand(-1, move_embedding.shape[1], -1)
        logits = self.policy_head(torch.cat([board_context, move_embedding], dim=-1)).squeeze(-1)
        logits = logits.masked_fill(move_mask <= 0, torch.finfo(logits.dtype).min)
        value = self.value_head(board_embedding).squeeze(-1)
        return logits, value

